import express from 'express';
import { hashPassword, verifyPassword } from './auth.js';
import jwt from 'jsonwebtoken';
import { pool } from "./db.js";

const JWT_SECRET = 'dev-secret-change-me'; // this needs to be stored in an env variable

const app = express();

function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

app.use((req, res, next) => {
  console.log('Request came in for', req.url);
  next();
});

app.use(express.json());

app.post("/applications", requireAuth, async (req, res) => {
  const { name, description } = req.body;

  if (!name || !description) {
    return res.status(400).json({ error: "Name and description required" });
  }

  const result = await pool.query(
    "INSERT INTO applications (name, description, user_id) VALUES ($1, $2, $3) RETURNING *",
    [name, description, req.user.id],
  );

  res.status(201).json(result.rows[0]);
});

app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
    email,
  ]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: "User already exists" });
  }

  const passwordHash = await hashPassword(password);

  const result = await pool.query(
    "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING *",
    [email, passwordHash, "user"],
  );

  const user = result.rows[0];

  res.status(201).json({ id: user.id, email: user.email });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const checkUser = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  if (checkUser.rows.length === 0) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const user = checkUser.rows[0];

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: "15m",
  });

  res.json({ token });
});

app.get("/me", requireAuth, async (req, res) => {
  const checkUser = await pool.query("SELECT * FROM users WHERE id = $1", [
    req.user.id,
  ]);

  const user = checkUser.rows[0];

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({ id: user.id, email: user.email, role: user.role });
});

app.get("/applications", requireAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM applications WHERE user_id = $1",
    [req.user.id],
  );
  res.json(result.rows);
});

app.get("/applications/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const result = await pool.query(
    "SELECT * FROM applications WHERE id = $1 AND user_id = $2",
    [id, req.user.id],
  );
  const application = result.rows[0];
  if (!application) {
    return res.status(404).json({ error: "Application not found" });
  }

  res.json(application);
});

app.put("/applications/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { name, description } = req.body;

  if (!name || !description) {
    return res.status(400).json({ error: "Name and description required" });
  }

  const result = await pool.query(
    "UPDATE applications SET name = $1, description = $2 WHERE id = $3 AND user_id = $4 RETURNING *",
    [name, description, id, req.user.id],
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Application not found" });
  }

  res.json(result.rows[0]);
});

app.delete("/applications/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);

  const result = await pool.query(
    "DELETE FROM applications WHERE id = $1 AND user_id = $2 RETURNING *",
    [id, req.user.id],
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Application not found" });
  }

  res.status(204).end();
});

app.get("/admin/users", requireAuth, requireRole("admin"), async (req, res) => {
  const result = await pool.query("SELECT id, email, role FROM users");
  res.json(result.rows);
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/boom', (req, res) => {
  throw new Error('kaboom');
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
})

app.listen(3000, () => console.log("Listening on http://localhost:3000"));
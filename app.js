import express from 'express';
import { hashPassword, verifyPassword } from './auth.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'dev-secret-change-me'; // this needs to be stored in an env variable

const users = [];
const applications = [];

// NEW: running counters, independent of array length.
// These only ever go up — never recalculated from how many
// records currently exist, so they survive deletions and can't collide.
let nextUserId = 1;
let nextApplicationId = 1;

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

app.post("/applications", requireAuth, (req, res) => {
  const { name, description } = req.body;

  if (!name || !description) {
    return res.status(400).json({ error: "Name and description required" });
  }

  const userId = req.user.id;
  const application = { id: nextApplicationId++, name, description, userId };
  applications.push(application);
  res.status(201).json(application);
});

app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  if (users.find(u => u.email === email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await hashPassword(password);
  const user = { id: nextUserId++, email, passwordHash, role: "user" };
  users.push(user);

  res.status(201).json({ id: user.id, email: user.email });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: "15m",
  });

  res.json({ token });
});

app.get('/me', requireAuth, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  res.json({ id: user.id, email: user.email, role: user.role });
});

app.get("/applications", requireAuth, (req, res) => {
  const mine = applications.filter((a) => a.userId === req.user.id);
  res.json(mine);
});

app.get("/applications/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const application = applications.find((a) => a.id === id);
  if (!application || application.userId !== req.user.id) {
    return res.status(404).json({ error: "Application not found" });
  }
  res.json(application);
});

app.put("/applications/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const application = applications.find((a) => a.id === id);
  if (!application || application.userId !== req.user.id) {
    return res.status(404).json({ error: "Application not found" });
  }
  const { name, description } = req.body;
  if (!name || !description) {
    return res.status(400).json({ error: "Name and description required" });
  }
  application.name = name;
  application.description = description;
  res.json(application);
});

app.get('/admin/users', requireAuth, requireRole('admin'), (req, res) => {
  res.json(users.map(u => ({ id: u.id, email: u.email, role: u.role })));
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
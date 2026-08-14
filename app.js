import express from 'express';
import { hashPassword, verifyPassword } from './auth.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'dev-secret-change-me'; // this needs to be stored in an env variable

const users = [];
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

app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  if (users.find(u => u.email === email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await hashPassword(password);
  users.push({ id: users.length + 1, email, passwordHash, role: 'admin' });

  res.status(201).json({ id: users.length, email });
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

  const token = jwt.sign(
  { sub: user.id, role: user.role },
  JWT_SECRET,
  { expiresIn: '15m' }
);

  res.json({ token });
});

app.get('/me', requireAuth, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  res.json({ id: user.id, email: user.email, role: user.role });
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

app.listen(3000, () => console.log('Listening on http://localhost:3000'));

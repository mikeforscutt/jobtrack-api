import express from 'express';
import { hashPassword, verifyPassword } from './auth.js';
import jwt from 'jsonwebtoken';
import pinoHttp from "pino-http";
import cors from "cors";
import client from "prom-client";
import {
  findByEmail,
  findById,
  create,
  findAll,
  getTotalUsers,
} from "./repositories/userRepository.js";

import {
  insertApplication,
  getApplicationsByUser,
  getApplicationByIdAndUser,
  updateApplication,
  deleteApplication,
  getTotalApplications,
  countByStatus,
} from "./repositories/applicationRepository.js";

import {
  getOpenJobs,
  getRecentJobs,
  getPopularJobs,
} from "./repositories/jobsRepository.js";

const JWT_SECRET = process.env.JWT_SECRET;

const app = express();

client.collectDefaultMetrics();

const httpRequestCounter = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

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
const allowedOrigins = [
  "http://localhost:5173",
  "https://jobtrack-web-eight.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  }),
);
const logger = pinoHttp();

app.use(express.json());
app.use(logger);

app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;

    httpRequestCounter.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });
    httpRequestDuration.observe(
      { method: req.method, route, status_code: res.statusCode },
      duration,
    );
  });

  next();
});

app.post("/applications", requireAuth, async (req, res) => {
  const { job_id } = req.body;

  if (!job_id) {
    return res.status(400).json({ error: "job_id is required" });
  }

  const newApplication = await insertApplication(job_id, req.user.id);

  if (newApplication === "duplicate") {
    return res
      .status(409)
      .json({ error: "You have already applied to this job" });
  }

  if (!newApplication) {
    return res.status(400).json({ error: "Invalid job_id" });
  }

  res.status(201).json(newApplication);
});

app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const existing = await findByEmail(email);
  if (existing) {
    return res.status(409).json({ error: "User already exists" });
  }

  const passwordHash = await hashPassword(password);

  const user = await create(email, passwordHash);

  res.status(201).json({ id: user.id, email: user.email });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const checkUser = await findByEmail(email);

  if (!checkUser) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const user = checkUser;

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

 const token = jwt.sign(
   { sub: user.id, role: user.role, email: user.email },
   JWT_SECRET,
   { expiresIn: "15m" },
 );

  res.json({ token });
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

app.get("/jobs", async (req, res) => {
  const pageSize = Number(req.query.pageSize) || 10;
  const pageNumber = Number(req.query.pageNumber) || 1;
  const search = req.query.search || "";

  const { jobs, totalJobs } = await getOpenJobs(pageSize, pageNumber, search);

  res.json({ jobs, totalJobs, pageSize, pageNumber });
});

app.get("/jobs/recent", async (req, res) => {
  const jobs = await getRecentJobs(5);
  res.json(jobs);
});

app.get("/jobs/popular", async (req, res) => {
  const jobs = await getPopularJobs(5);
  res.json(jobs);
});

app.get("/me", requireAuth, async (req, res) => {
  const user = await findById(req.user.id);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({ id: user.id, email: user.email, role: user.role });
});

app.get("/applications", requireAuth, async (req, res) => {
  const applications = await getApplicationsByUser(req.user.id);
  res.json(applications);
});

app.get("/applications/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);

  const application = await getApplicationByIdAndUser(id, req.user.id);
  if (!application) {
    return res.status(404).json({ error: "Application not found" });
  }

  res.json(application);
});

app.get("/admin/stats", requireAuth, requireRole("admin"), async (req, res) => {
  const totalUsers = await getTotalUsers();
  const totalApplications = await getTotalApplications();
  const statusCounts = await countByStatus();

  res.json({
    totalUsers,
    totalApplications,
    statusCounts: statusCounts.map((row) => ({
      status: row.status,
      count: Number(row.count),
    })),
  });
});

app.put("/applications/:id", requireAuth, async (req, res) => {
  const id = req.params.id;
  const { status } = req.body;

  const updatedApplication = await updateApplication(id, req.user.id, {
    status,
  });

  if (!updatedApplication) {
    return res.status(404).json({ error: "Application not found" });
  }

  res.json(updatedApplication);
});

app.delete("/applications/:id", requireAuth, async (req, res) => {
  const id = req.params.id;
  const success = await deleteApplication(id, req.user.id);
  if (!success) {
    return res.status(404).json({ error: "Application not found" });
  }
  res.sendStatus(204);
});

app.get("/admin/users", requireAuth, requireRole("admin"), async (req, res) => {
  const users = await findAll();
  res.json(users);
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

export default app;
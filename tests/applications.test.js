import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { pool } from '../db.js';
import { hashPassword } from '../auth.js';
import jwt from 'jsonwebtoken';

let tokenA, tokenB, userA, userB, testJob;

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

beforeEach(async () => {
  await pool.query("DELETE FROM applications");
  await pool.query("DELETE FROM jobs");
  await pool.query("DELETE FROM users");

  const hashedPassword = await hashPassword("letmein");

  const resultA = await pool.query(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *",
    ["userA@example.com", hashedPassword],
  );
  userA = resultA.rows[0];
  tokenA = signToken(userA);

  const resultB = await pool.query(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *",
    ["userB@example.com", hashedPassword],
  );
  userB = resultB.rows[0];
  tokenB = signToken(userB);

  const jobResult = await pool.query(
    "INSERT INTO jobs (company_name, job_title) VALUES ($1, $2) RETURNING *",
    ["Acme Corp", "Backend engineer"],
  );
  testJob = jobResult.rows[0];
});

describe("POST /applications", () => {
  it("creates an application as userA and returns 201 with correct user_id", async () => {
    const response = await request(app)
      .post("/applications")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ job_id: testJob.id });

    expect(response.status).toBe(201);
    expect(response.body.user_id).toBe(userA.id);
    expect(response.body.job_id).toBe(testJob.id);
  });

  it("returns 400 when job_id does not exist", async () => {
    const response = await request(app)
      .post("/applications")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ job_id: 999999 });

    expect(response.status).toBe(400);
  });

  it("returns 400 when job_id is missing", async () => {
    const response = await request(app)
      .post("/applications")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({});

    expect(response.status).toBe(400);
  });
});

describe("GET /applications/:id", () => {
  it("returns 404 when the application is owned by another user", async () => {
    const createResponse = await request(app)
      .post("/applications")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ job_id: testJob.id });

    const applicationId = createResponse.body.id;

    const fetchResponse = await request(app)
      .get(`/applications/${applicationId}`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect(fetchResponse.status).toBe(404);
  });

  it("returns the application when fetched by its owner", async () => {
    const createResponse = await request(app)
      .post("/applications")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ job_id: testJob.id });

    const applicationId = createResponse.body.id;

    const fetchResponse = await request(app)
      .get(`/applications/${applicationId}`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(fetchResponse.status).toBe(200);
    expect(fetchResponse.body.id).toBe(applicationId);
    expect(fetchResponse.body.company_name).toBe("Acme Corp");
    expect(fetchResponse.body.job_title).toBe("Backend engineer");
  });
});

describe("PUT /applications/:id", () => {
  it("updates the status as userA and returns 200", async () => {
    const createResponse = await request(app)
      .post("/applications")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ job_id: testJob.id });

    const applicationId = createResponse.body.id;

    const updateResponse = await request(app)
      .put(`/applications/${applicationId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ status: "interviewing" });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.status).toBe("interviewing");
  });

  it("returns 404 when attempting to update the application as userB", async () => {
    const createResponse = await request(app)
      .post("/applications")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ job_id: testJob.id });

    const applicationId = createResponse.body.id;

    const updateResponse = await request(app)
      .put(`/applications/${applicationId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ status: "interviewing" });

    expect(updateResponse.status).toBe(404);
  });
});

describe("DELETE /applications/:id", () => {
  it("deletes the application as userA and returns 204", async () => {
    const createResponse = await request(app)
      .post("/applications")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ job_id: testJob.id });

    const applicationId = createResponse.body.id;

    const deleteResponse = await request(app)
      .delete(`/applications/${applicationId}`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(deleteResponse.status).toBe(204);

    const fetchResponse = await request(app)
      .get(`/applications/${applicationId}`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(fetchResponse.status).toBe(404);
  });

  it("returns 404 when attempting to delete the application as userB", async () => {
    const createResponse = await request(app)
      .post("/applications")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ job_id: testJob.id });

    const applicationId = createResponse.body.id;

    const deleteResponse = await request(app)
      .delete(`/applications/${applicationId}`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect(deleteResponse.status).toBe(404);
  });
});
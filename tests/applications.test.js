import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { pool } from '../db.js';
import { hashPassword } from '../auth.js';
import jwt from 'jsonwebtoken';

let tokenA, tokenB, userA, userB;

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

beforeEach(async () => {
  await pool.query('DELETE FROM applications');
  await pool.query('DELETE FROM users');

  const hashedPassword = await hashPassword('letmein');

  const resultA = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *',
    ['userA@example.com', hashedPassword]
  );
  userA = resultA.rows[0];
  tokenA = signToken(userA);

  const resultB = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *',
    ['userB@example.com', hashedPassword]
  );
  userB = resultB.rows[0];
  tokenB = signToken(userB);
});

describe('POST /applications', () => {
  it("creates an application as userA and returns 201 with correct user_id", async () => {
    const response = await request(app)
      .post("/applications")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "My Application", description: "This is my application" });

    expect(response.status).toBe(201);
    expect(response.body.user_id).toBe(userA.id);
  });
});

describe('GET /applications/:id', () => {
  it('returns 404 when the application is owned by another user', async () => {
    const createResponse = await request(app)
      .post('/applications')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'My Application', description: 'This is my application' });

    const applicationId = createResponse.body.id;

    const fetchResponse = await request(app)
      .get(`/applications/${applicationId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(fetchResponse.status).toBe(404);
  });

  it('returns the application when fetched by its owner', async () => {
    const createResponse = await request(app)
      .post('/applications')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'My Application', description: 'This is my application' });

    const applicationId = createResponse.body.id;

    const fetchResponse = await request(app)
      .get(`/applications/${applicationId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(fetchResponse.status).toBe(200);
    expect(fetchResponse.body.id).toBe(applicationId);
  });
});

describe("PUT /applications/:id", () => {
  it("updates the application as userA and returns 200", async () => {
    const createResponse = await request(app)
      .post("/applications")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "My Application", description: "This is my application" });

    const applicationId = createResponse.body.id;

    const updateData = {
      name: "Updated Application",
      description: "This is the updated application",
    };

    const updateResponse = await request(app)
      .put(`/applications/${applicationId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send(updateData);

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.name).toBe(updateData.name);
    expect(updateResponse.body.description).toBe(updateData.description);
  });

  it("returns 404 when attempting to update the application as userB", async () => {
    const createResponse = await request(app)
      .post("/applications")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "My Application", description: "This is my application" });

    const applicationId = createResponse.body.id;

    const updateResponse = await request(app)
      .put(`/applications/${applicationId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({
        name: "Updated Application",
        description: "This is the updated application",
      });

    expect(updateResponse.status).toBe(404);
  });
});
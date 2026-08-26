import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { pool } from '../db.js';

beforeEach(async () => {
  await pool.query('DELETE FROM applications');
  await pool.query('DELETE FROM users');
});

describe('POST /register', () => {
  it('returns 400 when email is missing', async () => {
    const response = await request(app)
      .post('/register')
      .send({ password: 'letmein' });

    expect(response.status).toBe(400);
  });
});

it('creates a user and returns 201', async () => {
  const response = await request(app)
    .post('/register')
    .send({ email: 'newuser@example.com', password: 'letmein' });

  expect(response.status).toBe(201);
  expect(response.body.email).toBe('newuser@example.com');
});
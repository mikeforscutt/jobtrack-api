import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { pool } from '../db.js';
import { hashPassword } from '../auth.js';

beforeEach(async () => {
  await pool.query('DELETE FROM applications');
  await pool.query('DELETE FROM users');

  const hashedPassword = await hashPassword('letmein');
  await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
    ['newuser@example.com', hashedPassword]
  );
});

describe('POST /login', () => {
  it('returns 401 when email is missing', async () => {
    const response = await request(app)
      .post('/login')
      .send({ password: 'letmein' });

    expect(response.status).toBe(401);
  });

  it('logs in a user and returns 200', async () => {
    const loginResponse = await request(app)
      .post('/login')
      .send({ email: 'newuser@example.com', password: 'letmein' });

    expect(loginResponse.status).toBe(200);
  });
});
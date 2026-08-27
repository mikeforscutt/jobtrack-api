import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { pool } from '../db.js';
import { hashPassword } from '../auth.js';
import jwt from 'jsonwebtoken';

let token;

beforeEach(async () => {
  await pool.query('DELETE FROM applications');
  await pool.query('DELETE FROM users');

  const hashedPassword = await hashPassword('letmein');
  const result = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *',
    ['newuser@example.com', hashedPassword]
  );

  const user = result.rows[0];
  token = jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
});

describe('GET /me', () => {
  it('returns 401 with no token', async () => {
    const response = await request(app).get('/me');
    expect(response.status).toBe(401);
  });

  it('returns the current user with a valid token', async () => {
    const response = await request(app)
      .get('/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.email).toBe('newuser@example.com');
  });
});
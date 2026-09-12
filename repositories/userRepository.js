import { pool } from '../db.js';

export async function findAll() {
  const result = await pool.query('SELECT id, email, role FROM users');
  return result.rows;
}

export async function findByEmail(email) {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0];
}

export async function findById(id) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
}

export async function create(email, passwordHash) {
  const result = await pool.query(
    'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING *',
    [email, passwordHash, 'user']
  );
  return result.rows[0];
}


import { pool } from '../db.js';

export async function insertApplication(application) {
  const result = await pool.query(
    "INSERT INTO applications (user_id, name, description) VALUES ($1, $2, $3) RETURNING *",
    [application.user_id, application.name, application.description]
  );
  return result.rows[0];
}

export async function getApplicationsByUser(user_id) {
  const result = await pool.query(
    "SELECT * FROM applications WHERE user_id = $1",
    [user_id]
  );
  return result.rows;
}

export async function getApplicationByIdAndUser(id, user_id) {
  const result = await pool.query(
    "SELECT * FROM applications WHERE id = $1 AND user_id = $2",
    [id, user_id]
  );
  return result.rows[0];
}

export async function updateApplication(id, user_id, application) {
  const result = await pool.query(
    "UPDATE applications SET name = $1, description = $2 WHERE id = $3 AND user_id = $4 RETURNING *",
    [application.name, application.description, id, user_id]
  );
  return result.rows[0];
}

export async function deleteApplication(id, user_id) {
  const result = await pool.query(
    "DELETE FROM applications WHERE id = $1 AND user_id = $2",
    [id, user_id]
  );
  return result.rowCount > 0;
}
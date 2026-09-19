import { pool } from "../db.js";

export async function insertApplication(job_id, user_id) {
  try {
    const result = await pool.query(
      "INSERT INTO applications (job_id, user_id) VALUES ($1, $2) RETURNING *",
      [job_id, user_id],
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === "23503") {
      return null;
    }
    if (err.code === "23505") {
      return "duplicate";
    }
    throw err;
  }
}

export async function getApplicationsByUser(user_id) {
  const result = await pool.query(
    `SELECT applications.id, applications.status, jobs.id AS job_id, jobs.company_name, jobs.job_title
     FROM applications
     JOIN jobs ON applications.job_id = jobs.id
     WHERE applications.user_id = $1`,
    [user_id],
  );
  return result.rows;
}

export async function getApplicationByIdAndUser(id, user_id) {
  const result = await pool.query(
    `SELECT applications.id, applications.status, jobs.id AS job_id, jobs.company_name, jobs.job_title
     FROM applications
     JOIN jobs ON applications.job_id = jobs.id
     WHERE applications.id = $1 AND applications.user_id = $2`,
    [id, user_id],
  );
  return result.rows[0];
}

export async function updateApplication(id, user_id, updatedData) {
  const { status } = updatedData;
  const result = await pool.query(
    "UPDATE applications SET status = COALESCE($1, status) WHERE id = $2 AND user_id = $3 RETURNING *",
    [status, id, user_id],
  );
  return result.rows[0];
}

export async function deleteApplication(id, user_id) {
  const result = await pool.query(
    "DELETE FROM applications WHERE id = $1 AND user_id = $2",
    [id, user_id],
  );
  return result.rowCount > 0;
}

export async function countByStatus() {
  const result = await pool.query(
    "SELECT status, COUNT(*) FROM applications GROUP BY status",
  );
  return result.rows;
}

export async function getTotalApplications() {
  const result = await pool.query("SELECT COUNT(*) FROM applications");
  return Number(result.rows[0].count);
}

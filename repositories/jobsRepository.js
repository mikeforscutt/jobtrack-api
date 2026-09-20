import { pool } from "../db.js";

export async function getOpenJobs(pageSize, pageNumber, search = "") {
  const offset = (pageNumber - 1) * pageSize;
  const searchPattern = `%${search}%`;

  const result = await pool.query(
    `SELECT * FROM jobs
     WHERE open = true
     AND (company_name ILIKE $1 OR job_title ILIKE $1)
     ORDER BY id
     LIMIT $2 OFFSET $3`,
    [searchPattern, pageSize, offset],
  );

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM jobs
     WHERE open = true
     AND (company_name ILIKE $1 OR job_title ILIKE $1)`,
    [searchPattern],
  );
  const totalJobs = Number(countResult.rows[0].count);

  return {
    jobs: result.rows,
    totalJobs,
  };
}
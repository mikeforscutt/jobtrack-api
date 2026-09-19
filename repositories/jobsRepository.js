import { pool } from "../db.js";

export async function getOpenJobs(pageSize, pageNumber) {
  const offset = (pageNumber - 1) * pageSize;
  const result = await pool.query(
    `SELECT * FROM jobs
     WHERE open = true
     ORDER BY id
     LIMIT $1 OFFSET $2`,
    [pageSize, offset],
  );

  // Count of all open jobs
  const countQuery = "SELECT COUNT(*) FROM jobs WHERE open = true";
  const countResult = await pool.query(countQuery);
  const totalJobs = Number(countResult.rows[0].count);

  return {
    jobs: result.rows,
    totalJobs,
  };
}
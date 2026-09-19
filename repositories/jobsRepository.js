import { pool } from "../db.js";

export async function getOpenJobs() {
  const result = await pool.query(
    "SELECT * FROM jobs WHERE open = true"
  );
  return result.rows;
}
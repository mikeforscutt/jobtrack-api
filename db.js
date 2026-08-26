import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const connectionString =
  process.env.NODE_ENV === "test"
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

export const pool = new Pool({ connectionString });

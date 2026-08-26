import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: 'postgres://mikeforscutt@localhost:5432/jobtrack',
});
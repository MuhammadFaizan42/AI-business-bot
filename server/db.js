import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // uncomment ssl for hosted DBs:
  // ssl: { rejectUnauthorized: false }
});

// optional helper
export async function testConnection() {
  const res = await pool.query('SELECT 1 as ok');
  return res.rows[0];
}
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // สำคัญ: รองรับ self-signed (เช่น Render PG, Supabase, Neon)
  ssl: { rejectUnauthorized: false },
});
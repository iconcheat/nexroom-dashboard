// src/lib/db.ts
import { Pool } from 'pg';

/**
 * ใช้ตัวแปร DATABASE_URL จาก .env หรือ Render Environment
 * ตัวอย่าง: postgres://username:password@host:5432/dbname
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('❌ DATABASE_URL is not defined in environment variables');
}

// ใช้ global variable ป้องกันการสร้าง pool ซ้ำใน dev mode
let globalPool: Pool | undefined = (global as any)._pgPool;

if (!globalPool) {
  globalPool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false, // Render.com ต้องใช้แบบนี้
    },
    max: 10,          // จำกัดจำนวน connection พร้อมกัน
    idleTimeoutMillis: 30000, // ปล่อย connection ทิ้งหลังว่าง 30 วิ
  });
  (global as any)._pgPool = globalPool;
}

export const pool = globalPool;

/** 
 * ฟังก์ชันเรียกใช้งาน Pool ได้จากทุกที่ในระบบ 
 * ใช้ใน route: const pool = getPool();
 */
export function getPool(): Pool {
  return pool;
}

/**
 * Helper สำหรับ query ง่าย ๆ (ไม่บังคับใช้)
 * ตัวอย่าง: const rows = await db.query('SELECT * FROM app.staff_users');
 */
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows;
}
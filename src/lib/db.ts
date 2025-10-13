// src/lib/db.ts
import pg from 'pg';

/** เก็บ Pool ไว้บน global เพื่อกันสร้างซ้ำตอน HMR/SSR */
type GlobalWithPgPool = typeof globalThis & { __NXR_PG_POOL?: pg.Pool };

function getPoolConfig(): pg.PoolConfig {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('[db] missing env DATABASE_URL');
  }

  // บน Render/Prod ต้องเปิด SSL (แต่ไม่ตรวจ cert)
  const isLocal =
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1');

  return {
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: Number(process.env.PGPOOL_MAX ?? 5),
    idleTimeoutMillis: Number(process.env.PGPOOL_IDLE ?? 10_000),
    connectionTimeoutMillis: Number(process.env.PGCONNECT_TIMEOUT ?? 10_000),
  };
}

/** คืน singleton pg.Pool */
export function getPool(): pg.Pool {
  const g = global as GlobalWithPgPool;
  if (g.__NXR_PG_POOL) return g.__NXR_PG_POOL;

  const pool = new pg.Pool(getPoolConfig());
  pool.on('error', (err) => {
    // ป้องกัน process ล่มเมื่อมี idle client error
    console.error('[db] idle client error:', err);
  });

  g.__NXR_PG_POOL = pool;
  return pool;
}

/** ใช้ query สั้น ๆ (แนะนำสำหรับ read พื้นฐาน) */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[] }> {
  const res = await getPool().query(text, params);
  return { rows: res.rows as T[] };
}

/** withClient สำหรับงานที่ต้องใช้ client โดยตรง */
export async function withClient<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/** transaction helper */
export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  return withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  });
}

/** ปิด pool (ใช้ตอนปิดแอพ/ทดสอบ) */
export async function endPool() {
  const g = global as GlobalWithPgPool;
  if (g.__NXR_PG_POOL) {
    await g.__NXR_PG_POOL.end();
    g.__NXR_PG_POOL = undefined;
  }
}

export type { PoolClient } from 'pg';
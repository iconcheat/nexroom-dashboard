import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: NextRequest) {
  const dormId = req.headers.get('x-dorm-id'); // ดึงจาก cookie/session ก็ได้ถ้าคุณต้องการ
  if (!dormId) {
    return NextResponse.json({ ok: false, error: 'missing_dorm_id' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT job_id, job_type, status, result_url, created_at, finished_at
       FROM app.queue_jobs
       WHERE dorm_id = $1::uuid AND status = 'done'
       ORDER BY finished_at DESC NULLS LAST
       LIMIT 10;`,
      [dormId]
    );

    return NextResponse.json({ ok: true, data: rows });
  } finally {
    client.release();
  }
}
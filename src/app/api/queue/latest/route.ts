import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pkg from 'pg';

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET(req: Request) {
  try {
    // ✅ ต้อง await
    const cookieStore = await cookies();
    const sessionRaw = cookieStore.get('nxr_session')?.value;

    let dormId: string | null = null;
    if (sessionRaw) {
      try {
        const j = JSON.parse(decodeURIComponent(sessionRaw));
        dormId = j?.dorm_id || null;
        console.log('🏠 dorm_id from cookie:', dormId);
      } catch {
        console.warn('⚠️ Failed to parse nxr_session');
      }
    }

    if (!dormId) {
      return NextResponse.json({ ok: false, error: 'missing_dorm_id' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || '10'), 1), 50);

    const { rows } = await pool.query(
      `
      SELECT
        job_id,
        job_type AS title,     -- ใช้ job_type แทน title
        status,
        progress,
        result_url,
        created_at
      FROM app.queue_jobs
      WHERE dorm_id = $1
      ORDER BY created_at DESC
      LIMIT $2;
      `,
      [dormId, limit]
    );

    return NextResponse.json({ ok: true, data: rows });
  } catch (err: any) {
    console.error('❌ queue/latest error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'internal_error' },
      { status: 500 }
    );
  }
}
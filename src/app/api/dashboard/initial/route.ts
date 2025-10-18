import { NextRequest, NextResponse } from 'next/server';
import { extractSessionId } from '@/lib/bus';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const querySid = url.searchParams.get('session_id') || '';
  const sid = querySid || extractSessionId(req);
  if (!sid)
    return NextResponse.json({ ok: false, error: 'missing_session' }, { status: 401 });

  const pool = getPool();

  try {
    // ✅ join session → user → dorm
    const q = `
      SELECT 
        ss.session_id,
        su.username,
        su.role,
        d.dorm_name
      FROM app.staff_sessions ss
      LEFT JOIN app.staff_users su ON su.staff_id = ss.staff_id
      LEFT JOIN app.dorms d ON d.dorm_id = ss.dorm_id
      WHERE ss.session_id = $1
      ORDER BY ss.created_at DESC
      LIMIT 1;
    `;
    const r = await pool.query(q, [sid]);

    const row = r.rows[0];
    const dormName = row?.dorm_name ?? null;
    const userName = row?.username ?? null;
    const userRole = row?.role ?? null;

    // ✅ ดึง event ล่าสุด
    let lastSummary: any | null = null;
    try {
      const rs = await pool.query(
        `SELECT payload
           FROM app.sse_events
          WHERE session_id = $1
            AND topic IN ('reserve_summary','payment_done')
          ORDER BY created_at DESC
          LIMIT 1`,
        [sid]
      );
      lastSummary = rs.rows[0]?.payload ?? null;
    } catch {}

    return NextResponse.json(
      {
        ok: true,
        session_id: sid,
        dorm_name: dormName,
        user_name: userName,
        user_role: userRole,
        last_reserve_summary: lastSummary,
      },
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch (err: any) {
    console.error('initial route error', err);
    return NextResponse.json(
      { ok: false, error: 'db_query_failed', details: err.message },
      { status: 500 }
    );
  }
}
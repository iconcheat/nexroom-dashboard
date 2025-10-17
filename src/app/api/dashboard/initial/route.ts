// src/app/api/dashboard/initial/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { extractSessionId } from '@/lib/bus';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const querySid = url.searchParams.get('session_id') || '';
  const sid = querySid || extractSessionId(req);
  if (!sid) return NextResponse.json({ ok: false, error: 'missing_session' }, { status: 401 });

  const pool = getPool();

  let dormId: string | null = null;
  let dormName: string | null = null;
  let userName: string | null = null;

  // 1) หา dorm_id + ชื่อหอ + ชื่อผู้ใช้ (ถ้ามีตาราง)
  try {
    const s = await pool.query(
      `SELECT dorm_id, staff_id
         FROM app.staff_sessions
        WHERE session_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [sid]
    );
    dormId = s.rows[0]?.dorm_id ?? null;
    const staffId = s.rows[0]?.staff_id ?? null;

    if (dormId) {
      try {
        const d = await pool.query(
          `SELECT name FROM app.dorms WHERE dorm_id = $1 LIMIT 1`,
          [dormId]
        );
        dormName = d.rows[0]?.name ?? null;
      } catch { /* ตาราง/คอลัมน์อาจไม่มี */ }
    }

    if (staffId) {
      try {
        const u = await pool.query(
          `SELECT display_name FROM app.staffs WHERE staff_id = $1 LIMIT 1`,
          [staffId]
        );
        userName = u.rows[0]?.display_name ?? null;
      } catch { /* ตาราง/คอลัมน์อาจไม่มี */ }
    }
  } catch (e) {
    // ignore → ใช้ default
  }

  // default fallback
  if (!dormName) dormName = 'PD Place';
  if (!userName) userName = 'Manager';

  // 2) ดึง last reserve_summary / payment_done ของ session นี้
  let lastSummary: any | null = null;
  try {
    const rs = await pool.query(
      `SELECT topic, payload
         FROM app.sse_events
        WHERE session_id = $1
          AND topic IN ('reserve_summary','payment_done')
        ORDER BY created_at DESC
        LIMIT 1`,
      [sid]
    );
    if (rs.rowCount) {
      lastSummary = rs.rows[0].payload || null;
    }
  } catch (e) {
    // ignore
  }

  return NextResponse.json({
    ok: true,
    session_id: sid,
    dorm_id: dormId,
    dorm_name: dormName,
    user_name: userName,
    last_reserve_summary: lastSummary,
  }, { headers: { 'cache-control': 'no-store' } });
}
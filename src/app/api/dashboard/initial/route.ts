// src/app/api/dashboard/initial/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { extractSessionId } from '@/lib/bus';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // --- 1) หา session_id จาก query/cookie ---
  const url = new URL(req.url);
  const querySid = url.searchParams.get('session_id') || '';
  const sid = querySid || extractSessionId(req);
  if (!sid) {
    return NextResponse.json(
      { ok: false, error: 'missing_session' },
      { status: 401 }
    );
  }

  const pool = getPool();

  // ตัวแปรกลาง (อย่าประกาศซ้ำ)
  let dormId: string | null = null;
  let staffId: string | null = null;
  let dormName: string | null = null;
  let userName: string | null = null;
  let userRole: string | null = null;

  // --- 2) อ่าน dorm_id + staff_id จากตาราง session ---
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
    staffId = s.rows[0]?.staff_id ?? null;
  } catch {
    // เงียบไว้ ใช้ค่าเริ่มต้น null
  }

  // --- 3) ดึงชื่อหอจาก app.dorms (รองรับทั้ง dorm_name | name) ---
  if (dormId) {
    try {
      const d = await pool.query(
        `SELECT COALESCE(dorm_name, name) AS dorm_name
           FROM app.dorms
          WHERE dorm_id = $1
          LIMIT 1`,
        [dormId]
      );
      dormName = d.rows[0]?.dorm_name ?? null;
    } catch {
      // เงียบไว้
    }
  }

  // --- 4) ดึง username/role จาก app.staff_users (fallback display_name) ---
  if (staffId) {
    try {
      const u = await pool.query(
        `SELECT COALESCE(username, display_name) AS username, role
           FROM app.staff_users
          WHERE staff_id = $1
          LIMIT 1`,
        [staffId]
      );
      userName = u.rows[0]?.username ?? null;
      userRole = u.rows[0]?.role ?? null;
    } catch {
      // เงียบไว้
    }
  }

  // --- Fallback เฉพาะกรณีไม่มีใน DB จริง ๆ ---
  if (!dormName) dormName = 'PD Place';
  if (!userName) userName = 'Manager';

  // --- 5) ดึง event ล่าสุดของ session นี้ (reserve_summary / payment_done) ---
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
  } catch {
    // เงียบไว้
  }

  // --- 6) ส่งออก ---
  return NextResponse.json(
    {
      ok: true,
      session_id: sid,
      dorm_id: dormId,
      dorm_name: dormName,
      user_name: userName,
      user_role: userRole, // เผื่อใช้ในอนาคต
      last_reserve_summary: lastSummary,
    },
    { headers: { 'cache-control': 'no-store' } }
  );
}
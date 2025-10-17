// src/app/api/session/me/route.ts
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db'; // ถ้าแดง ให้ดูหมายเหตุด้านล่าง

export const runtime = 'nodejs';

export async function GET() {
  try {
    const pool = getPool();

    // ✅ ในโปรเจกต์คุณ cookies()/headers() เป็น Promise จึงต้อง await
    const cookieStore = await cookies();
    const sid = cookieStore.get('nxr_session')?.value || null;

    if (!sid) {
      return NextResponse.json(
        { ok: false, need_login: true, reason: 'missing_cookie' },
        { status: 401 }
      );
    }

    // ตรวจสอบ session + ดึงข้อมูลผู้ใช้/หอพัก
    const qSession = `
      SELECT s.session_id, s.staff_id, s.dorm_id, s.is_valid, s.expires_at,
             u.username, u.full_name, u.role, u.telegram_id,
             d.dorm_name AS dorm_name
      FROM app.staff_sessions s
      JOIN app.staff_users  u ON s.staff_id = u.staff_id
      LEFT JOIN app.dorms   d ON s.dorm_id  = d.dorm_id
      WHERE s.session_id = $1
      LIMIT 1;
    `;
    const { rows } = await pool.query(qSession, [sid]);
    const s = rows[0];

    if (!s) {
      return NextResponse.json(
        { ok: false, need_login: true, reason: 'invalid_session' },
        { status: 401 }
      );
    }

    const now = Date.now();
    const exp = new Date(s.expires_at).getTime();
    if (s.is_valid === false || exp <= now) {
      return NextResponse.json(
        { ok: false, need_login: true, reason: 'session_expired' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        staff_id:   s.staff_id,
        username:   s.username,
        full_name:  s.full_name,
        role:       s.role,
        dorm_id:    s.dorm_id,
        dorm_name:  s.dorm_name,
        telegram_id:s.telegram_id,
        session_id: s.session_id,
        expires_at: s.expires_at,
      },
      { status: 200 }
    );

  } catch (err: any) {
    console.error('session.me error:', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sid = url.searchParams.get('sid') || '';
  const maxAge = Number(url.searchParams.get('maxAge') || url.searchParams.get('max') || 28800);
  const to = url.searchParams.get('to') || '/dashboard';

  if (!sid) {
    return NextResponse.json({ ok:false, error:'missing_sid' }, { status:400 });
  }

  // 1) ตั้ง nxr_session ก่อน
  const res = NextResponse.redirect(to, { status: 303 });
  res.cookies.set('nxr_session', sid, {
    httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge,
  });

  // 2) ดึงข้อมูลผู้ใช้จาก DB แล้วตั้ง cookie เพิ่ม
  try {
    const pool = getPool();
    const q = `
      SELECT s.session_id, s.staff_id, s.dorm_id, s.is_valid, s.expires_at,
             u.username, u.full_name, u.role, u.telegram_id, u.plan_name
      FROM app.staff_sessions s
      JOIN app.staff_users  u ON s.staff_id = u.staff_id
      WHERE s.session_id = $1
      LIMIT 1;
    `;
    const { rows } = await pool.query(q, [sid]);
    const v = rows[0];

    if (v && v.is_valid) {
      const c = [
        ['staff_id',   String(v.staff_id || '')],
        ['dorm_id',    String(v.dorm_id || '')],
        ['username',   String(v.username || '')],
        ['role',       String(v.role || 'viewer')],
        ['telegram_id',String(v.telegram_id || '')],
        ['plan_name',  String(v.plan_name || '')],
      ] as const;

      for (const [k, val] of c) {
        res.cookies.set(k, val, { httpOnly:false, sameSite:'lax', secure:true, path:'/', maxAge });
      }
    }
  } catch (e) {
    // ไม่ให้ redirect ล่มเพราะตั้ง cookie เพิ่มไม่สำเร็จ
    console.error('bridge extra cookies error:', e);
  }

  return res;
}
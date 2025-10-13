// src/app/api/session/bridge/route.ts
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sid    = url.searchParams.get('sid') || '';
  const maxAge = Number(url.searchParams.get('maxAge') || url.searchParams.get('max') || 28800);
  const toPath = url.searchParams.get('to') || '/dashboard';

  if (!sid) {
    return NextResponse.json({ ok:false, error:'missing_sid' }, { status:400 });
  }

  // บังคับใช้ host เดียวกับที่เรียกเข้ามา (กัน redirect ไป localhost)
  const currentHost = new URL(req.url).origin || 'https://nexroom-dashboard.onrender.com';
  const to = new URL(toPath, currentHost);

  // ตั้ง nxr_session + session_id ก่อน (HttpOnly สำหรับ sid)
  const res = NextResponse.redirect(to, { status: 303 });
  res.cookies.set('nxr_session', sid, {
    httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge,
  });
  res.cookies.set('session_id', sid, {
    httpOnly: false, sameSite: 'lax', secure: true, path: '/', maxAge,
  });

  // ดึงข้อมูลผู้ใช้ + ตั้งคุกกี้ non-HttpOnly ที่เหลือ
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

    // ต้อง valid และไม่หมดอายุ
    const notExpired = v?.expires_at ? new Date(v.expires_at).getTime() > Date.now() : true;
    if (v && v.is_valid && notExpired) {
      const pairs: ReadonlyArray<readonly [string, string]> = [
        ['staff_id',    String(v.staff_id ?? '')],
        ['dorm_id',     String(v.dorm_id ?? '')],
        ['username',    String(v.username ?? '')],
        ['role',        String(v.role ?? 'viewer')],
        ['telegram_id', String(v.telegram_id ?? '')],
        ['plan_name',   String(v.plan_name ?? '')],
      ];

      for (const [k, val] of pairs) {
        res.cookies.set(k, val, {
          httpOnly: false, sameSite: 'lax', secure: true, path: '/', maxAge,
        });
      }
    }
  } catch (e) {
    console.error('bridge extra cookies error:', e);
    // ไม่ throw เพื่อให้ redirect ไปต่อได้
  }

  return res;
}
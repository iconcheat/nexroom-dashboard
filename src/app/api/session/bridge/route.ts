// src/app/api/session/bridge/route.ts
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    // อ่าน query param ที่ส่งมาจาก n8n
    const url = new URL(req.url);
    const sid = url.searchParams.get('sid') || '';
    const maxAge = Number(url.searchParams.get('maxAge') || url.searchParams.get('max') || 28800);
    const toPath = url.searchParams.get('to') || '/dashboard';

    if (!sid) {
      return NextResponse.json({ ok: false, error: 'missing_sid' }, { status: 400 });
    }

    // ✅ ดึง host จริงจาก header เพื่อกัน redirect ไป localhost:10000
    const hostHeader = req.headers.get('host') || 'nexroom-dashboard.onrender.com';
    const protocol = hostHeader.includes('localhost') ? 'http' : 'https';
    const origin = `${protocol}://${hostHeader}`;
    const to = new URL(toPath, origin);

    // ✅ ตั้งค่า cookie หลัก (sid)
    const res = NextResponse.redirect(to, { status: 303 });
    res.cookies.set('nxr_session', sid, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge,
    });
    // duplicate ไว้อ่านฝั่ง client ได้ด้วย
    res.cookies.set('session_id', sid, {
      httpOnly: false,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge,
    });

    // ✅ ดึงข้อมูลผู้ใช้จาก DB แล้วตั้งคุกกี้เพิ่ม
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

      const notExpired = v?.expires_at ? new Date(v.expires_at).getTime() > Date.now() : true;

      if (v && v.is_valid && notExpired) {
        const cookiePairs: Array<[string, string]> = [
          ['staff_id', String(v.staff_id ?? '')],
          ['dorm_id', String(v.dorm_id ?? '')],
          ['username', String(v.username ?? '')],
          ['role', String(v.role ?? 'viewer')],
          ['telegram_id', String(v.telegram_id ?? '')],
          ['plan_name', String(v.plan_name ?? '')],
        ];

        for (const [k, val] of cookiePairs) {
          res.cookies.set(k, val, {
            httpOnly: false,
            sameSite: 'lax',
            secure: true,
            path: '/',
            maxAge,
          });
        }
      } else {
        console.warn('Invalid or expired session in bridge:', sid);
      }
    } catch (dbErr) {
      console.error('bridge: failed to set extra cookies:', dbErr);
    }

    return res;
  } catch (err: any) {
    console.error('bridge route error:', err);
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
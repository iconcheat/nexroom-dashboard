// src/app/api/session/bridge/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs'; // เหมาะกับ Render

/**
 * /api/session/bridge?sid=<session_id>&maxAge=28800&to=/dashboard&return=json
 * - sid:     (จำเป็น) session_id ที่ n8n สร้างให้
 * - maxAge:  อายุคุกกี้เป็นวินาที (ค่าเริ่มต้น 8 ชม. = 28800)
 * - to:      path ที่จะ redirect ไปหลังตั้งคุกกี้ (default: /dashboard)
 * - return:  ถ้า = json จะไม่ redirect แต่คืน JSON แทน (ใช้ debug ได้)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const sid =
    url.searchParams.get('sid') ||
    url.searchParams.get('session_id') ||
    '';

  const maxAge = Number(
    url.searchParams.get('maxAge') ||
      url.searchParams.get('max') ||
      28800 // 8 ชั่วโมง
  );

  const to = url.searchParams.get('to') || '/dashboard';
  const wantsJson = (url.searchParams.get('return') || '').toLowerCase() === 'json';

  if (!sid) {
    return NextResponse.json({ ok: false, error: 'missing_sid' }, { status: 400 });
  }

  // สร้าง base url สำหรับ redirect (รองรับ localhost/Render)
  const host = req.headers.get('host') || '';
  const isLocal = host.includes('localhost') || host.startsWith('127.0.0.1');
  const proto = isLocal ? 'http' : 'https';
  const base = `${proto}://${host}`;

  // เตรียม response: redirect หรือ JSON
  const res = wantsJson
    ? NextResponse.json({ ok: true, setCookie: true, sid, maxAge, to })
    : NextResponse.redirect(`${base}${to}`, { status: 303 });

  // ตั้งคุกกี้ session (httpOnly)
  res.cookies.set('nxr_session', sid, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !isLocal, // production ให้ secure=true
    path: '/',
    maxAge,
  });

  return res;
}
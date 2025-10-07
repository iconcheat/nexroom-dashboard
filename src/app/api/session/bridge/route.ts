import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sid = url.searchParams.get('sid');
  const maxAge = Number(url.searchParams.get('maxAge') || '28800'); // 8 ชั่วโมง

  if (!sid) {
    return NextResponse.json({ ok: false, error: 'missing_sid' }, { status: 400 });
  }

  // ตั้งคุกกี้แล้วรีไดเรกต์ไป /dashboard
  const res = NextResponse.redirect(new URL('/dashboard', req.url));

  // หมายเหตุ: ไม่กำหนด domain (ให้ browser จับ subdomain ปัจจุบันอัตโนมัติ)
  res.cookies.set({
    name: 'nxr_session',
    value: sid,
    httpOnly: true,
    secure: true,          // บังคับบน Render (HTTPS)
    sameSite: 'lax',       // เปิดจากโดเมนเดียวกัน
    path: '/',
    maxAge,                // วินาที
  });

  return res;
}
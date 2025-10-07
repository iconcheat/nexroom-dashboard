import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sid = url.searchParams.get('sid');
  const maxAge = Number(url.searchParams.get('maxAge') || '28800');

  if (!sid) {
    return NextResponse.json({ ok: false, error: 'missing_sid' }, { status: 400 });
  }

  // ✅ ตั้งคุกกี้สำหรับโดเมนนี้ (first-party cookie)
  const res = NextResponse.redirect(new URL('/dashboard', req.url));
  res.cookies.set({
    name: 'nxr_session',
    value: sid,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
  return res;
}
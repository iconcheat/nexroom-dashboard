import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  // อ่าน host ปัจจุบันจาก header
  const host = req.headers.get('host') || '';
  const proto = host.includes('localhost') ? 'http' : 'https';
  const base = `${proto}://${host}`;

  const url = new URL(req.url);
  const sid = url.searchParams.get('sid') || '';
  const maxAge = Number(url.searchParams.get('maxAge') || url.searchParams.get('max') || 28800);
  const to = url.searchParams.get('to') || '/dashboard';
  const returnJson = url.searchParams.get('return') === 'json';

  if (!sid) {
    return NextResponse.json({ ok: false, error: 'missing_sid' }, { status: 400 });
  }

  const res = returnJson
    ? NextResponse.json({ ok: true, setCookie: true, sid, maxAge, to })
    : NextResponse.redirect(`${base}${to}`, { status: 303 });

  res.cookies.set('nxr_session', sid, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge,
  });

  return res;
}
// src/app/api/session/route.ts
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sid = url.searchParams.get('sid') || '';
  const to = url.searchParams.get('to') || '/dashboard';
  const returnJson = url.searchParams.get('return') === 'json';
  const maxAge = Number(url.searchParams.get('maxAge') || 28800);

  if (!sid) {
    return NextResponse.json({ ok: false, error: 'missing_sid' }, { status: 400 });
  }

  const res = returnJson
    ? NextResponse.json({ ok: true, setCookie: true, sid, maxAge, to })
    : NextResponse.redirect(to, { status: 303 });

  res.cookies.set('nxr_session', sid, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge,
  });

  return res;
}
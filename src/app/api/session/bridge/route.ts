import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sid = url.searchParams.get('sid');
  const max = parseInt(url.searchParams.get('max') || '28800', 10); // default 8 ชม.

  if (!sid) {
    return NextResponse.json({ ok: false, error: 'missing_sid' }, { status: 400 });
  }

  const jar = await cookies(); // Next.js 14/15: เป็น async
  jar.set('nxr_session', sid, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: max,
  });

  // กลับไปหน้า dashboard
  return NextResponse.redirect(new URL('/dashboard', url), { status: 303 });
}
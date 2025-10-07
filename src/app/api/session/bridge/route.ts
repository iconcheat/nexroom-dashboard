import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  const url = new URL(req.url);

  // รับค่า
  const sid    = url.searchParams.get('sid') || '';
  const maxAge = Number(url.searchParams.get('maxAge') || url.searchParams.get('max') || 8 * 3600);
  const to     = url.searchParams.get('to') || '/dashboard'; // ปลายทางหลังตั้งคุกกี้

  if (!sid) {
    return NextResponse.json({ ok: false, error: 'missing_sid' }, { status: 400 });
  }

  // ตั้งคุกกี้บนโดเมนของแอพ (โดเมน Render ปัจจุบัน)
  const res = NextResponse.redirect(new URL(to, url.origin), { status: 303 });
  res.cookies.set('nxr_session', sid, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: isFinite(maxAge) ? Math.max(60, maxAge | 0) : 8 * 3600,
  });

  // ดีบัก: ?return=json จะไม่ redirect แต่ตอบเป็น JSON แทน
  if (url.searchParams.get('return') === 'json') {
    // ต้องใช้ headers() เพราะเราเพิ่งตั้งคุกกี้ใน res (ยังไม่ได้เขียนกลับจริง)
    return NextResponse.json({ ok: true, setCookie: true, sid, maxAge, to }, { status: 200 });
  }

  return res;
}
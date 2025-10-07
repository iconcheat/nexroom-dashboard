import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sid = url.searchParams.get('sid');
  const dormId = url.searchParams.get('d') || '';
  const role = url.searchParams.get('r') || '';

  if (!sid) {
    return NextResponse.json({ ok: false, error: 'missing_sid' }, { status: 400 });
  }

  const res = NextResponse.redirect(new URL('/dashboard', url.origin), { status: 303 });

  // ตั้งคุกกี้บนโดเมนแดชบอร์ดเอง (คนละโดเมนกับ n8n ต้องตั้งใหม่)
  res.cookies.set('nxr_session', sid, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 24, // 1 วัน (ปรับได้)
  });
  // optional: เก็บ dorm/role แบบ non-HttpOnly เผื่อโชว์ชื่อเร็ว ๆ ที่ client
  if (dormId) res.cookies.set('nxr_dorm', dormId, { sameSite: 'lax', secure: true, path: '/' });
  if (role)   res.cookies.set('nxr_role', role,   { sameSite: 'lax', secure: true, path: '/' });

  return res;
}
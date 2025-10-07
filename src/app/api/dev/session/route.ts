import { NextRequest, NextResponse } from 'next/server';

const COOKIE = 'nxr_session'; // ต้องตรงกับที่คุณใช้ในระบบ

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sid = searchParams.get('sid') || '';
  const redirect = searchParams.get('redirect') || '/dashboard';

  if (!sid) {
    return NextResponse.json({ ok: false, error: 'missing_sid' }, { status: 400 });
  }

  const res = NextResponse.redirect(redirect, { status: 303 });

  // บน Render เป็น HTTPS จริง → ใช้ secure:true ได้
  // อายุคุกกี้ปล่อย 8 ชม. (28800s) แค่สำหรับ dev; โปรดปรับตามค่าจริงจาก n8n ได้
  res.cookies.set(COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });

  return res;
}
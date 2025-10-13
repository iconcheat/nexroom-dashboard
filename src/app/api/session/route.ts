// src/app/api/session/route.ts
import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';

export async function GET() {
  const c = cookies();
  const h = headers();

  // helper ที่ normalize type ให้เป็น string|null เสมอ
  const getCookie = (k: string): string | null => c.get(k)?.value ?? null;
  const getHeader = (k: string): string | null => h.get(k) ?? null;

  const session = {
    staff_id:   getCookie('staff_id')   ?? getHeader('x-staff-id'),
    username:   getCookie('username'),
    full_name:  getCookie('full_name'),
    role:       getCookie('role') ?? 'staff',
    dorm_id:    getCookie('dorm_id')    ?? getHeader('x-dorm-id'),
    dorm_name:  getCookie('dorm_name'),
    session_id: getCookie('session_id'),
    telegram_id:getCookie('telegram_id'),
  };

  if (!session.staff_id) {
    return NextResponse.json({ ok:false, error:'no_session' }, { status: 401 });
  }
  return NextResponse.json(session);
}
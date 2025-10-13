import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const c = await cookies();
  return NextResponse.json({
    nxr_session: c.get('nxr_session')?.value || null,
    staff_id:    c.get('staff_id')?.value || null,
    dorm_id:     c.get('dorm_id')?.value || null,
    username:    c.get('username')?.value || null,
    role:        c.get('role')?.value || null,
    telegram_id: c.get('telegram_id')?.value || null,
    plan_name:   c.get('plan_name')?.value || null,
  });
}
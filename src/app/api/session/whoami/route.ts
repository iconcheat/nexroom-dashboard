import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const jar = await cookies(); // <- สำคัญ: ต้อง await ใน Next รุ่นใหม่
  const sid = jar.get('nxr_session')?.value || null;
  return NextResponse.json({ ok: !!sid, sid });
}
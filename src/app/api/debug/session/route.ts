import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET() {
  const sid = (await cookies()).get('nxr_session')?.value || null;
  if (!sid) return NextResponse.json({ ok:false, error:'no sid' }, { status:400 });

  const { rows } = await getPool().query(
    `SELECT s.session_id, s.staff_id, s.dorm_id, s.is_valid, s.expires_at,
            u.username, u.full_name, u.role, u.telegram_id, u.plan_name
       FROM app.staff_sessions s
       JOIN app.staff_users  u ON s.staff_id = u.staff_id
      WHERE s.session_id = $1
      LIMIT 1`,
    [sid]
  );
  return NextResponse.json({ ok:true, row: rows[0] || null });
}
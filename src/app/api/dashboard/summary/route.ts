// src/app/api/dashboard/summary/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const c = await cookies();
    const dorm_id = c.get('dorm_id')?.value || null;
    if (!dorm_id) return NextResponse.json({ ok:false, error:'no_dorm' }, { status: 401 });

    const pool = getPool();
    const { rows } = await pool.query(
      `
      select
        (select count(*) from app.rooms where dorm_id=$1) as total_rooms,
        (select count(*) from app.rooms where dorm_id=$1 and status='vacant') as vacant,
        (select count(*) from app.bookings where dorm_id=$1 and status='reserved' and move_in_date >= current_date) as upcoming_checkin,
        (select coalesce(sum(amount),0) from app.invoices where dorm_id=$1 and status in ('generated','sent') and due_date <= current_date) as due_amount
      `,
      [dorm_id]
    );

    return NextResponse.json({ ok:true, data: rows[0] || {} }, {
      headers: { 'cache-control': 'private, max-age=15' }, // cache เบา ๆ
    });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:String(e?.message || e) }, { status: 500 });
  }
}
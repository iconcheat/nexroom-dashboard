// src/app/api/dashboard/route.ts  (เฉพาะส่วน core)
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { pool } from '../../../lib/db';
export async function GET() {
  try {
    const sid = (await cookies()).get('nxr_session')?.value || null;
    if (!sid) return NextResponse.json({ ok:false, error:'unauthorized' }, { status:401 });

    const client = await pool.connect();
    try {
      const s = await client.query(/* session + dorm */`
        select ss.staff_id, ss.dorm_id, su.full_name, su.role, row_to_json(d) as dorm_row
        from app.staff_sessions ss
        join app.staff_users su on su.staff_id = ss.staff_id
        left join app.dorms d on d.dorm_id = ss.dorm_id
        where ss.session_id = $1 and ss.is_valid = true and ss.expires_at > now() limit 1
      `,[sid]);
      if (s.rowCount === 0) return NextResponse.json({ ok:false, error:'unauthorized' }, { status:401 });

      const { staff_id, dorm_id, full_name, role, dorm_row } = s.rows[0];
      const dormName = dorm_row?.name ?? dorm_row?.dorm_name ?? dorm_row?.title ?? '-';

      // 🔹 ยิงพร้อมกัน
      const [r1,r2,r3,r4,r5,r6] = await Promise.all([
        client.query(`select count(*)::int as total from app.rooms where dorm_id=$1`, [dorm_id]),
        client.query(`select count(*)::int as occupied from app.rooms where dorm_id=$1 and status='occupied'`, [dorm_id]),
        client.query(`select count(*)::int as vacant from app.rooms where dorm_id=$1 and status='vacant'`, [dorm_id]),
        client.query(`select count(*)::int as repairing from app.rooms where dorm_id=$1 and status='repairing'`, [dorm_id]),
        client.query(`select count(*)::int as unpaid from app.invoices where dorm_id=$1 and status in ('overdue','partially_paid')`, [dorm_id]),
        client.query(`select count(*)::int as open from app.maintenance where dorm_id=$1 and status='open'`, [dorm_id]),
      ]);

      return NextResponse.json({
        ok:true,
        summary:{
          totalRooms: r1.rows[0].total,
          occupied: r2.rows[0].occupied,
          vacant: r3.rows[0].vacant,
          repairing: r4.rows[0].repairing,
          unpaidBills: r5.rows[0].unpaid,
          maintenanceOpen: r6.rows[0].open,
        },
        dorm:{ id:dorm_id, name:dormName },
        user:{ id:staff_id, name: full_name || '-', role:(role||'viewer').toLowerCase() },
        timestamp: new Date().toISOString(),
      });
    } finally { client.release(); }
  } catch (err:any) {
    return NextResponse.json({ ok:false, error: err.message || 'server_error' }, { status:500 });
  }
}
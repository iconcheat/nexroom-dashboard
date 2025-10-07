import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Render/Neon มักต้องใช้ SSL
});

export async function GET() {
  try {
    const jar = await cookies(); // ✅ ต้อง await
    const sid = jar.get('nxr_session')?.value || null;
    if (!sid) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const client = await pool.connect();

    // ดึง staff + dorm จาก session
    const sessQ = await client.query(
      `select s.staff_id, s.dorm_id, d.name as dorm_name
         from app.staff_sessions s
         join app.dorms d on d.dorm_id = s.dorm_id
        where s.session_id = $1 and coalesce(s.is_valid,true) = true
          and now() < s.expires_at
        limit 1`,
      [sid],
    );
    if (sessQ.rowCount === 0) {
      client.release();
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    const { dorm_id, dorm_name } = sessQ.rows[0];

    // นับเฉพาะของ dorm นี้
    const rooms      = await client.query(`select count(*)::int as total      from app.rooms        where dorm_id = $1`, [dorm_id]);
    const occupied   = await client.query(`select count(*)::int as occupied   from app.rooms        where dorm_id = $1 and status='occupied'`, [dorm_id]);
    const vacant     = await client.query(`select count(*)::int as vacant     from app.rooms        where dorm_id = $1 and status='vacant'`, [dorm_id]);
    const repairing  = await client.query(`select count(*)::int as repairing  from app.rooms        where dorm_id = $1 and status='repairing'`, [dorm_id]);
    const bills      = await client.query(`select count(*)::int as unpaid     from app.invoices     where dorm_id = $1 and (status='overdue' or status='partially_paid')`, [dorm_id]);
    const maint      = await client.query(`select count(*)::int as open       from app.maintenance  where dorm_id = $1 and status='open'`, [dorm_id]);

    client.release();

    return NextResponse.json({
      ok: true,
      dorm: { dormId: dorm_id, name: dorm_name }, // ← ส่งชื่อหอออกไปให้โชว์หัวข้อใหญ่
      summary: {
        totalRooms: rooms.rows[0].total,
        occupied:   occupied.rows[0].occupied,
        vacant:     vacant.rows[0].vacant,
        repairing:  repairing.rows[0].repairing,
        unpaidBills: bills.rows[0].unpaid,
        maintenanceOpen: maint.rows[0].open,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err.message ?? 'server_error' }, { status: 500 });
  }
}
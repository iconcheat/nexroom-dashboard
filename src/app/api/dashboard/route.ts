import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET() {
  try {
    const jar = await cookies();
    const sid = jar.get('nxr_session')?.value || null;

    if (!sid) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const client = await pool.connect();

    // หา session → staff_id, dorm_id
    const s = await client.query(
      `select ss.staff_id, ss.dorm_id, su.full_name, d.name as dorm_name
       from app.staff_sessions ss
       join app.staff_users su on su.staff_id = ss.staff_id
       left join app.dorms d on d.dorm_id = ss.dorm_id
       where ss.session_id = $1 and ss.is_valid = true and ss.expires_at > now()
       limit 1`,
      [sid],
    );
    if (s.rowCount === 0) {
      client.release();
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    const { dorm_id, dorm_name } = s.rows[0];

    // ดึงสรุปเฉพาะหอ (ใช้ dorm_id ฟิลเตอร์ทุกตาราง)
    const { rows: r1 } = await client.query(
      `select count(*)::int as total from app.rooms where dorm_id = $1`, [dorm_id],
    );
    const { rows: r2 } = await client.query(
      `select count(*)::int as occupied from app.rooms where dorm_id = $1 and status='occupied'`, [dorm_id],
    );
    const { rows: r3 } = await client.query(
      `select count(*)::int as vacant from app.rooms where dorm_id = $1 and status='vacant'`, [dorm_id],
    );
    const { rows: r4 } = await client.query(
      `select count(*)::int as repairing from app.rooms where dorm_id = $1 and status='repairing'`, [dorm_id],
    );
    const { rows: r5 } = await client.query(
      `select count(*)::int as unpaid from app.invoices where dorm_id = $1 and status in ('overdue','partially_paid')`, [dorm_id],
    );
    const { rows: r6 } = await client.query(
      `select count(*)::int as open from app.maintenance where dorm_id = $1 and status='open'`, [dorm_id],
    );

    client.release();

    return NextResponse.json({
      ok: true,
      summary: {
        totalRooms: r1[0].total,
        occupied: r2[0].occupied,
        vacant: r3[0].vacant,
        repairing: r4[0].repairing,
        unpaidBills: r5[0].unpaid,
        maintenanceOpen: r6[0].open,
      },
      dorm: { id: dorm_id, name: dorm_name || '-' },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('dashboard_error', err);
    return NextResponse.json({ ok: false, error: err.message || 'server_error' }, { status: 500 });
  }
}
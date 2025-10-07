import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  try {
    // ✅ อ่านคุกกี้ชื่อ nxr_session
    const cookieStore = await cookies();
    const sid = cookieStore.get('nxr_session')?.value;

    if (!sid) {
      return NextResponse.json(
        { ok: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    const client = await pool.connect();

    // ✅ ตรวจ session_id จากตาราง session จริงในฐานข้อมูล
    const session = await client.query(
      `SELECT staff_id, dorm_id FROM app.staff_session WHERE session_id=$1 AND expires_at > NOW()`,
      [sid]
    );

    if (session.rowCount === 0) {
      client.release();
      return NextResponse.json(
        { ok: false, error: 'session_expired_or_invalid' },
        { status: 401 }
      );
    }

    const dormId = session.rows[0].dorm_id;

    // ✅ ดึงชื่อหอพักตาม dorm_id
    const dormInfo = await client.query(
      `SELECT dorm_id AS id, dorm_name AS name FROM app.dorms WHERE dorm_id=$1`,
      [dormId]
    );

    const dorm = dormInfo.rows[0] || { id: dormId, name: 'Unknown Dorm' };

    // ✅ ดึงสรุปเฉพาะหอของผู้ใช้
    const rooms = await client.query(
      `SELECT COUNT(*) AS total FROM app.rooms WHERE dorm_id=$1`,
      [dormId]
    );
    const occupied = await client.query(
      `SELECT COUNT(*) AS occupied FROM app.rooms WHERE dorm_id=$1 AND status='occupied'`,
      [dormId]
    );
    const vacant = await client.query(
      `SELECT COUNT(*) AS vacant FROM app.rooms WHERE dorm_id=$1 AND status='vacant'`,
      [dormId]
    );
    const repairing = await client.query(
      `SELECT COUNT(*) AS repairing FROM app.rooms WHERE dorm_id=$1 AND status='repairing'`,
      [dormId]
    );

    const unpaid = await client.query(
      `SELECT COUNT(*) AS unpaid FROM app.invoices WHERE dorm_id=$1 AND (status='overdue' OR status='partially_paid')`,
      [dormId]
    );

    const open = await client.query(
      `SELECT COUNT(*) AS open FROM app.maintenance WHERE dorm_id=$1 AND status='open'`,
      [dormId]
    );

    client.release();

    return NextResponse.json({
      ok: true,
      dorm,
      summary: {
        totalRooms: rooms.rows[0].total,
        occupied: occupied.rows[0].occupied,
        vacant: vacant.rows[0].vacant,
        repairing: repairing.rows[0].repairing,
        unpaidBills: unpaid.rows[0].unpaid,
        maintenanceOpen: open.rows[0].open,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Dashboard Error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
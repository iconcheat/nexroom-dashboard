import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  try {
    // ✅ ต้องใช้ await cookies() เพราะตอนนี้มัน async แล้ว
    const cookieStore = await cookies();
    const sid = cookieStore.get('nxr_session')?.value || null;

    if (!sid) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const client = await pool.connect();

    // ดึง dorm_id จาก session
    const sessionRes = await client.query(
      `SELECT dorm_id FROM app.staff_sessions WHERE session_id = $1 AND is_valid = true LIMIT 1`,
      [sid]
    );

    if (sessionRes.rowCount === 0) {
      client.release();
      return NextResponse.json({ ok: false, error: 'invalid_session' }, { status: 401 });
    }

    const dormId = sessionRes.rows[0].dorm_id;

    // ✅ ดึงข้อมูลเฉพาะหอพักนี้เท่านั้น
    const rooms = await client.query(`SELECT COUNT(*) AS total FROM app.rooms WHERE dorm_id = $1`, [dormId]);
    const occupied = await client.query(`SELECT COUNT(*) AS occupied FROM app.rooms WHERE dorm_id = $1 AND status='occupied'`, [dormId]);
    const vacant = await client.query(`SELECT COUNT(*) AS vacant FROM app.rooms WHERE dorm_id = $1 AND status='vacant'`, [dormId]);
    const repairing = await client.query(`SELECT COUNT(*) AS repairing FROM app.rooms WHERE dorm_id = $1 AND status='repairing'`, [dormId]);

    const bills = await client.query(
      `SELECT COUNT(*) AS unpaid FROM app.invoices WHERE dorm_id = $1 AND (status='overdue' OR status='partially_paid')`,
      [dormId]
    );

    const maintenance = await client.query(
      `SELECT COUNT(*) AS open FROM app.maintenance WHERE dorm_id = $1 AND status='open'`,
      [dormId]
    );

    client.release();

    return NextResponse.json({
      ok: true,
      summary: {
        totalRooms: rooms.rows[0].total,
        occupied: occupied.rows[0].occupied,
        vacant: vacant.rows[0].vacant,
        repairing: repairing.rows[0].repairing,
        unpaidBills: bills.rows[0].unpaid,
        maintenanceOpen: maintenance.rows[0].open,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err.message });
  }
}
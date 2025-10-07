// src/app/api/dashboard/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  const client = await pool.connect();
  try {
    // 1) อ่าน session จากคุกกี้
    const sid = cookies().get('nxr_session')?.value || null;
    if (!sid) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    // 2) หา dorm_id และชื่อหอ จาก session (ยังไม่หมดอายุ + ใช้งานได้)
    const dormRes = await client.query<
      { dorm_id: string; dorm_name: string }
    >(
      `
      SELECT s.dorm_id, d.name AS dorm_name
      FROM app.staff_sessions s
      JOIN app.dorms d ON d.id = s.dorm_id
      WHERE s.session_id = $1
        AND s.is_valid = TRUE
        AND s.expires_at > NOW()
      LIMIT 1
      `,
      [sid],
    );

    if (dormRes.rowCount === 0) {
      return NextResponse.json({ ok: false, error: 'session_expired_or_invalid' }, { status: 401 });
    }

    const { dorm_id, dorm_name } = dormRes.rows[0];

    // 3) ดึงสรุปเฉพาะของ dorm_id นั้น
    const rooms = await client.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM app.rooms WHERE dorm_id = $1`,
      [dorm_id],
    );
    const occupied = await client.query<{ occupied: string }>(
      `SELECT COUNT(*) AS occupied FROM app.rooms WHERE dorm_id = $1 AND status = 'occupied'`,
      [dorm_id],
    );
    const vacant = await client.query<{ vacant: string }>(
      `SELECT COUNT(*) AS vacant FROM app.rooms WHERE dorm_id = $1 AND status = 'vacant'`,
      [dorm_id],
    );
    const repairing = await client.query<{ repairing: string }>(
      `SELECT COUNT(*) AS repairing FROM app.rooms WHERE dorm_id = $1 AND status = 'repairing'`,
      [dorm_id],
    );
    const bills = await client.query<{ unpaid: string }>(
      `SELECT COUNT(*) AS unpaid
         FROM app.invoices
        WHERE dorm_id = $1
          AND (status = 'overdue' OR status = 'partially_paid')`,
      [dorm_id],
    );
    const maintenance = await client.query<{ open: string }>(
      `SELECT COUNT(*) AS open
         FROM app.maintenance
        WHERE dorm_id = $1
          AND status = 'open'`,
      [dorm_id],
    );

    // 4) ส่งกลับ (แปลงเป็น number ให้เรียบร้อย + แนบ dorm object)
    return NextResponse.json({
      ok: true,
      dorm: { id: dorm_id, name: dorm_name },
      summary: {
        totalRooms: Number(rooms.rows[0].total ?? 0),
        occupied: Number(occupied.rows[0].occupied ?? 0),
        vacant: Number(vacant.rows[0].vacant ?? 0),
        repairing: Number(repairing.rows[0].repairing ?? 0),
        unpaidBills: Number(bills.rows[0].unpaid ?? 0),
        maintenanceOpen: Number(maintenance.rows[0].open ?? 0),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err.message ?? 'server_error' }, { status: 500 });
  } finally {
    client.release();
  }
}
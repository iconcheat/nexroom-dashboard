// src/app/api/dashboard/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Pool } from 'pg';

const useSSL = (process.env.PGSSLMODE || '').toLowerCase() === 'require';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
});

export async function GET() {
  try {
    // 1) อ่านคุกกี้เซสชัน
    const jar = await cookies();
    const sid = jar.get('nxr_session')?.value || null;
    if (!sid) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const client = await pool.connect();

    // 2) หา session + ข้อมูลผู้ใช้/หอ
    const s = await client.query(
      `
      select 
        ss.staff_id,
        ss.dorm_id,
        su.full_name,
        su.role,
        d.name as dorm_name
      from app.staff_sessions ss
      join app.staff_users su on su.staff_id = ss.staff_id
      left join app.dorms d on d.dorm_id = ss.dorm_id
      where ss.session_id = $1
        and ss.is_valid = true
        and ss.expires_at > now()
      limit 1
      `,
      [sid],
    );

    if (s.rowCount === 0) {
      client.release();
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const {
      staff_id,
      dorm_id,
      full_name,
      role,
      dorm_name,
    } = s.rows[0] as {
      staff_id: string;
      dorm_id: string;
      full_name: string | null;
      role: string | null;
      dorm_name: string | null;
    };

    const dormName = dorm_name || '-';

    // 3) นับสรุปเฉพาะหอพักนี้
    const { rows: r1 } = await client.query(
      `select count(*)::int as total from app.rooms where dorm_id = $1`,
      [dorm_id],
    );
    const { rows: r2 } = await client.query(
      `select count(*)::int as occupied from app.rooms where dorm_id = $1 and status = 'occupied'`,
      [dorm_id],
    );
    const { rows: r3 } = await client.query(
      `select count(*)::int as vacant from app.rooms where dorm_id = $1 and status = 'vacant'`,
      [dorm_id],
    );
    const { rows: r4 } = await client.query(
      `select count(*)::int as repairing from app.rooms where dorm_id = $1 and status = 'repairing'`,
      [dorm_id],
    );
    const { rows: r5 } = await client.query(
      `select count(*)::int as unpaid from app.invoices where dorm_id = $1 and status in ('overdue','partially_paid')`,
      [dorm_id],
    );
    const { rows: r6 } = await client.query(
      `select count(*)::int as open from app.maintenance where dorm_id = $1 and status = 'open'`,
      [dorm_id],
    );

    client.release();

    // 4) ส่งผลลัพธ์
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
      dorm: {
        id: dorm_id,
        name: dormName,
      },
      user: {
        id: staff_id,
        name: full_name || '-',
        role: (role || 'viewer').toLowerCase(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('dashboard_error', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'server_error' },
      { status: 500 },
    );
  }
}
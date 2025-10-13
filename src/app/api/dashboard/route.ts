// src/app/api/dashboard/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

type Cnt = { count?: number } & Record<string, any>;
const n = (v: any) => (v == null ? 0 : Number(v));

export async function GET() {
  try {
    // 1) ต้องมี session ก่อน
    const cookieStore = await cookies();
    const sid = cookieStore.get('nxr_session')?.value || null;
    if (!sid) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      // 2) ตรวจ session + ดึงข้อมูล user/dorm (ทำใน query เดียว)
      const qSession = `
        select ss.staff_id, ss.dorm_id,
               su.full_name, su.role,
               row_to_json(d) as dorm_row
        from app.staff_sessions ss
        join app.staff_users  su on su.staff_id = ss.staff_id
        left join app.dorms   d  on d.dorm_id   = ss.dorm_id
        where ss.session_id = $1
          and ss.is_valid   = true
          and ss.expires_at > now()
        limit 1;
      `;
      const s = await client.query(qSession, [sid]);
      if (s.rowCount === 0) {
        return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
      }

      const { staff_id, dorm_id, full_name, role, dorm_row } = s.rows[0] as any;
      const dormName =
        dorm_row?.name ?? dorm_row?.dorm_name ?? dorm_row?.title ?? '-';

      // 3) ยิง summary พร้อมกันให้เบาและเร็ว
      const [
        rTotal,
        rOcc,
        rVac,
        rRep,
        rUnpaid,
        rMaint,
      ] = await Promise.all([
        client.query<{ total: number }>(
          `select count(*)::int as total
           from app.rooms where dorm_id = $1`,
          [dorm_id]
        ),
        client.query<{ occupied: number }>(
          `select count(*)::int as occupied
           from app.rooms where dorm_id = $1 and status = 'occupied'`,
          [dorm_id]
        ),
        client.query<{ vacant: number }>(
          `select count(*)::int as vacant
           from app.rooms where dorm_id = $1 and status = 'vacant'`,
          [dorm_id]
        ),
        client.query<{ repairing: number }>(
          `select count(*)::int as repairing
           from app.rooms where dorm_id = $1 and status = 'repairing'`,
          [dorm_id]
        ),
        client.query<{ unpaid: number }>(
          `select count(*)::int as unpaid
           from app.invoices
           where dorm_id = $1
             and status in ('overdue','partially_paid')`,
          [dorm_id]
        ),
        client.query<{ open: number }>(
          `select count(*)::int as open
           from app.maintenance
           where dorm_id = $1 and status = 'open'`,
          [dorm_id]
        ),
      ]);

      // 4) รูปแบบผลลัพธ์เดียวกับที่คุณใช้อยู่
      const json = {
        ok: true,
        summary: {
          totalRooms: n(rTotal.rows[0]?.total),
          occupied: n(rOcc.rows[0]?.occupied),
          vacant: n(rVac.rows[0]?.vacant),
          repairing: n(rRep.rows[0]?.repairing),
          unpaidBills: n(rUnpaid.rows[0]?.unpaid),
          maintenanceOpen: n(rMaint.rows[0]?.open),
        },
        dorm: { id: dorm_id, name: dormName },
        user: {
          id: staff_id,
          name: full_name || '-',
          role: String(role || 'viewer').toLowerCase(),
        },
        timestamp: new Date().toISOString(),
      };

      return new NextResponse(JSON.stringify(json), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          // cache เบา ๆ ฝั่งเบราว์เซอร์ เพื่อไม่ยิงซ้ำ ๆ
          'cache-control': 'private, max-age=15',
        },
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
// src/app/api/dashboard/summary/route.ts
import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { getPool } from '@/lib/db';

const c = cookies();              // RequestCookies
const h = headers();

export const runtime = 'nodejs';

export async function GET() {
  try {
    const c = cookies(); const h = headers();
    const getC = (k: string) => c.get(k)?.value ?? null;
    const getH = (k: string) => h.get(k) ?? null;
    if (!dorm_id) return NextResponse.json({ ok:false, error:'no_dorm' }, { status: 401 });

    const pool = getPool();

    // ตัวอย่าง query ที่เบาและชัด (ปรับชื่อตาราง/คอลัมน์ให้ตรง schema จริง)
    const q1 = `
      SELECT
        COUNT(*)::int      AS total_rooms,
        COUNT(*) FILTER (WHERE status='vacant')::int  AS vacant,
        COUNT(*) FILTER (WHERE status='reserved')::int AS reserved,
        COUNT(*) FILTER (WHERE status='occupied')::int AS occupied
      FROM app.rooms WHERE dorm_id = $1;
    `;
    const q2 = `
      SELECT
        COALESCE(SUM(CASE WHEN status='unpaid' THEN amount ELSE 0 END),0)::numeric AS unpaid_amount,
        COUNT(*) FILTER (WHERE status='unpaid')::int AS unpaid_invoices
      FROM app.invoices
      WHERE dorm_id = $1 AND period = to_char(now(),'YYYY-MM');  -- ตัวอย่าง: รอบเดือนนี้
    `;
    const q3 = `
      SELECT
        COALESCE(SUM(CASE WHEN paid_at::date = CURRENT_DATE THEN amount ELSE 0 END),0)::numeric AS paid_today
      FROM app.payments WHERE dorm_id = $1;
    `;
    const [r1, r2, r3] = await Promise.all([
      pool.query(q1, [dorm_id]),
      pool.query(q2, [dorm_id]),
      pool.query(q3, [dorm_id]),
    ]);

    const rooms = r1.rows[0] || {};
    const unpaid = r2.rows[0] || {};
    const paid = r3.rows[0] || {};

    const total = Number(rooms.total_rooms || 0);
    const occ   = Number(rooms.occupied || 0);
    const occupancy = total ? Math.round((occ/total)*100) : 0;

    return NextResponse.json({
      ok: true,
      dorm_id,
      occupancy,                       // % อัตราเข้าพัก
      rooms: {
        total, vacant: Number(rooms.vacant||0),
        reserved: Number(rooms.reserved||0),
        occupied: occ,
      },
      billing: {
        unpaid_amount: Number(unpaid.unpaid_amount || 0),
        unpaid_invoices: Number(unpaid.unpaid_invoices || 0),
        paid_today: Number(paid.paid_today || 0),
      },
    });
  } catch (err:any) {
    return NextResponse.json({ ok:false, error:String(err?.message||err) }, { status: 500 });
  }
}
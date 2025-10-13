// src/app/api/dashboard/summary/route.ts
import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * คืนข้อมูลสรุปสำหรับแดชบอร์ด โดยผูกกับ dorm_id ของผู้ใช้
 * แหล่งที่มา: ตารางใน schema app.*
 */
export async function GET() {
  try {
    // อ่าน context จาก cookie/header (รองรับทั้งสองกรณี)
    const c = await cookies();
    const h = await headers();

    const dorm_id =
      c.get('dorm_id')?.value ??
      h.get('x-dorm-id') ??
      null;

    if (!dorm_id) {
      return NextResponse.json(
        { ok: false, error: 'no_dorm', message: 'missing dorm_id' },
        { status: 401 },
      );
    }

    const pool = getPool();

    // ===== ตัวอย่าง query สรุปที่เบาและชัด =====
    // ปรับชื่อตาราง/คอลัมน์ให้ตรง schema จริงของคุณได้เลย
    const q = `
      with
      rooms as (
        select room_id, status
        from app.rooms
        where dorm_id = $1
      ),
      bookings as (
        select booking_id, room, status
        from app.bookings
        where dorm_id = $1
      ),
      invoices as (
        select invoice_id, status, due_date
        from app.invoices
        where dorm_id = $1
      ),
      checkins_today as (
        select checkin_id
        from app.checkins
        where dorm_id = $1
          and date_trunc('day', planned_date) = date_trunc('day', now())
      ),
      work_orders_open as (
        select request_id
        from app.maintenance_requests
        where dorm_id = $1 and status in ('open','in_progress')
      )
      select
        (select count(*)        from rooms)                                   as total_rooms,
        (select count(*)        from rooms where status = 'vacant')           as vacant,
        (select count(*)        from rooms where status = 'occupied')         as occupied,
        (select count(*)        from bookings where status = 'reserved')      as reserved,
        (select count(*)        from invoices where status = 'pending'
           and (due_date is null or due_date <= now()))                      as due_invoices,
        (select count(*)        from checkins_today)                          as moveins_today,
        (select count(*)        from work_orders_open)                        as work_orders_open
    `;

    const { rows } = await pool.query(q, [dorm_id]);
    const summary = rows[0] ?? {
      total_rooms: 0,
      vacant: 0,
      occupied: 0,
      reserved: 0,
      due_invoices: 0,
      moveins_today: 0,
      work_orders_open: 0,
    };

    return NextResponse.json({
      ok: true,
      dorm_id,
      summary,
      // เผื่อหน้า UI อยากแสดง timestamp
      generated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: 'server_error', message: String(err?.message || err) },
      { status: 500 },
    );
  }
}
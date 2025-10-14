export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { tx } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    // ... assertBearer เหมือนเดิม ...

    const b = await req.json();
    const dorm_id   = b?.dorm_id?.trim();
    const booking_id = b?.booking_id || null;
    const amount    = Number(b?.amount);
    const paid_at   = b?.paid_at || null;
    const note      = b?.note || 'cash payment';
    const session_id = b?.session_id || null;

    if (!dorm_id) return NextResponse.json({ ok:false, error:'missing_dorm_id' }, { status:400 });
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok:false, error:'invalid_amount' }, { status:400 });
    }

    const out = await tx(async (c) => {
      // 1) ดึงชื่อหอตรง ๆ
      const d = await c.query(
        `SELECT COALESCE(d.display_name, d.name, d.title, d.code) AS dorm_name
         FROM app.dorms d
         WHERE d.dorm_id = $1::uuid
         LIMIT 1`,
        [dorm_id]
      );
      const dorm_name = d.rows[0]?.dorm_name || null;

      // 2) กันคลิกซ้ำสั้น ๆ (2 นาที) เฉพาะเงินสด + ยอดเท่ากัน
      const dup = await c.query(
        `SELECT payment_id
           FROM app.payments
          WHERE dorm_id = $1::uuid
            AND method = 'cash'
            AND amount = $2::numeric
            AND received_at > now() - interval '2 minutes'
          ORDER BY received_at DESC
          LIMIT 1`,
        [dorm_id, amount]
      );
      if (dup.rows[0]) {
        return { duplicate: true, payment_id: dup.rows[0].payment_id, dorm_name, booking_id };
      }

      // 3) ทำ idempotency key
      const idem = `cash:${crypto.randomBytes(4).toString('hex')}:${Date.now()}`;

      // 4) INSERT โดยไม่อิง room_id/tenant_id
      const ins = await c.query(
        `INSERT INTO app.payments (
            dorm_id, room_id, tenant_id, booking_id,
            method, source, amount, received_at,
            status, note, idempotency_key
         ) VALUES (
            $1::uuid, NULL, NULL, $2::uuid,
            'cash', 'ui:cash', $3::numeric, COALESCE($4::timestamptz, now()),
            'confirmed', $5::text, $6::text
         )
         RETURNING payment_id`,
        [dorm_id, booking_id, amount, paid_at, note, idem]
      );

      return { duplicate:false, payment_id: ins.rows[0].payment_id as string, dorm_name, booking_id };
    });

    // 5) push event กลับ dashboard
    if (session_id) {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ai/push`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${process.env.DASH_PUSH_TOKEN}`,
        },
        body: JSON.stringify({
          kind: 'payment.completed',
          dorm_id,
          dorm_name: out.dorm_name,
          booking_id: out.booking_id,
          payment: {
            id: out.payment_id,
            method: 'cash',
            amount,
            paid_at: paid_at || new Date().toISOString(),
            duplicate: out.duplicate,
          },
          message: `✅${out.dorm_name ? ` [${out.dorm_name}]` : ''} รับชำระเงินสด ${amount.toLocaleString()} บาท`,
          session_id,
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ ok:true, payment_id: out.payment_id, duplicate: out.duplicate });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok:false, error: e?.message || 'internal_error' }, { status: 500 });
  }
}
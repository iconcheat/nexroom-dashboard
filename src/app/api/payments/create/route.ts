// src/app/api/payments/create/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getPool, tx } from '@/lib/db';

type Body = {
  dorm_id: string;
  booking_id?: string | null;
  amount: number;
  paid_at?: string | null;
  note?: string | null;
  session_id?: string | null;
};

function assertBearer(req: NextRequest, envKey: string) {
  const want = process.env[envKey] || '';
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!want || got !== want) {
    const err: any = new Error('unauthorized');
    err.status = 401;
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    assertBearer(req, 'PAYMENTS_TOKEN');

    const b = (await req.json()) as Body;
    const dorm_id = b?.dorm_id?.trim();
    const booking_id = b?.booking_id || null;
    const amount = Number(b?.amount);
    const paid_at = b?.paid_at || null;
    const note = b?.note || 'cash payment';
    const session_id = b?.session_id || null;

    if (!dorm_id || !amount || Number.isNaN(amount)) {
      return NextResponse.json({ ok:false, error:'missing_fields' }, { status:400 });
    }

    const out = await tx(async (c) => {
      // 1) ดึง booking + ชื่อหอ (กันชื่อคอลัมน์ด้วย COALESCE)
      const q = await c.query(
        `
        SELECT
          b.booking_id, b.room_id, b.tenant_id, b.dorm_id,
          COALESCE(d.display_name, d.name, d.title, d.code) AS dorm_name
        FROM app.bookings b
        JOIN app.dorms d ON d.dorm_id = b.dorm_id
        WHERE b.dorm_id = $1::uuid
          AND ($2::uuid IS NULL OR b.booking_id = $2::uuid)
        ORDER BY b.created_at DESC
        LIMIT 1
        `,
        [dorm_id, booking_id]
      );
      const bk = q.rows[0] || null;

      // 2) กันคลิกซ้ำช่วงสั้น (2 นาที) สำหรับยอดเท่ากัน
      const dup = await c.query(
        `
        SELECT payment_id
        FROM app.payments
        WHERE dorm_id = $1::uuid
          AND method = 'cash'
          AND amount = $2::numeric
          AND received_at > now() - interval '2 minutes'
        ORDER BY received_at DESC
        LIMIT 1
        `,
        [dorm_id, amount]
      );
      if (dup.rows[0]) {
        return {
          duplicate: true,
          payment_id: dup.rows[0].payment_id as string,
          dorm_name: bk?.dorm_name || null,
          booking_id: bk?.booking_id || booking_id,
        };
      }

      // 3) idempotency_key อัตโนมัติ (กันซ้ำระดับ DB)
      const idem = `cash:${crypto.randomBytes(4).toString('hex')}:${Date.now()}`;

      // 4) INSERT payment
      let payment_id: string | null = null;
      try {
        const ins = await c.query(
          `
          INSERT INTO app.payments (
            dorm_id, room_id, tenant_id, booking_id,
            method, source, amount, received_at,
            status, note, idempotency_key
          )
          VALUES (
            $1::uuid, $2::uuid, $3::uuid, $4::uuid,
            'cash', 'ui:cash', $5::numeric, COALESCE($6::timestamptz, now()),
            'confirmed', $7::text, $8::text
          )
          RETURNING payment_id
          `,
          [
            dorm_id,
            bk?.room_id || null,
            bk?.tenant_id || null,
            bk?.booking_id || booking_id,
            amount,
            paid_at,
            note,
            idem,
          ]
        );
        payment_id = ins.rows[0].payment_id as string;
      } catch (e: any) {
        // ถ้าโดน unique (idempotency_key) ให้ select แถวเดิมกลับมา
        // code '23505' = unique_violation
        if (e?.code === '23505') {
          const r = await c.query(
            `SELECT payment_id FROM app.payments WHERE dorm_id=$1::uuid AND idempotency_key=$2 LIMIT 1`,
            [dorm_id, idem]
          );
          payment_id = r.rows[0]?.payment_id || null;
        } else {
          throw e;
        }
      }

      return {
        duplicate: false,
        payment_id,
        dorm_name: bk?.dorm_name || null,
        booking_id: bk?.booking_id || booking_id,
      };
    });

    // 5) ส่ง event กลับแดชบอร์ด (SSE ทาง /api/ai/push)
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
          message:
            `✅${out.dorm_name ? ` [${out.dorm_name}]` : ''} รับชำระเงินสด ` +
            `${amount.toLocaleString()} บาท`,
          session_id,
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ ok:true, payment_id: out.payment_id, duplicate: out.duplicate });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ ok:false, error: String(e?.message || e) }, { status: code });
  }
}
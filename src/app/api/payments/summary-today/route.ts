import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const dorm_id = url.searchParams.get('dorm_id') || '';
  if (!dorm_id) return NextResponse.json({ ok:false, error:'missing dorm_id' }, { status:400 });

  const q = await getPool().query(
    `
    SELECT
      COUNT(*)::int AS count_payments,
      COALESCE(SUM(amount),0)::numeric AS total_amount
    FROM app.payments
    WHERE dorm_id = $1::uuid
      AND status = 'confirmed'
      AND received_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Bangkok')
      AND received_at <  (date_trunc('day', now() AT TIME ZONE 'Asia/Bangkok') + interval '1 day')
    `,
    [dorm_id]
  );
  return NextResponse.json({ ok:true, ...q.rows[0] });
}
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const dorm_id = url.searchParams.get('dorm_id') || '';
  const limit = Math.min(Number(url.searchParams.get('limit') || 20), 100);
  if (!dorm_id) return NextResponse.json({ ok:false, error:'missing dorm_id' }, { status:400 });

  const q = await getPool().query(
    `
    SELECT payment_id, method, amount, received_at, status, note
    FROM app.payments
    WHERE dorm_id = $1::uuid
    ORDER BY received_at DESC
    LIMIT $2
    `,
    [dorm_id, limit]
  );
  return NextResponse.json({ ok:true, items: q.rows });
}
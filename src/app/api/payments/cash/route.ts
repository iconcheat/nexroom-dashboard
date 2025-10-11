// app/api/payments/cash/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const N8N_CASH_WEBHOOK = process.env.N8N_CASH_WEBHOOK!;     // เซิร์ฟเวอร์เท่านั้น (ไม่ใช่ NEXT_PUBLIC)
const N8N_SIGNING_SECRET = process.env.N8N_SIGNING_SECRET!; // secret สำหรับ HMAC

export async function POST(req: NextRequest) {
  const body = await req.text();

  // (ถ้าต้องการ) ตรวจสิทธิ์ผู้ใช้จาก cookie/session ที่นี่

  // สร้างลายเซ็น HMAC ให้ n8n ตรวจฝั่งโน้น (ป้องกันการยิงมั่ว)
  const sig = crypto.createHmac('sha256', N8N_SIGNING_SECRET).update(body).digest('hex');

  const res = await fetch(N8N_CASH_WEBHOOK, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-nexroom-signature': sig,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ ok: false, error: `n8n ${res.status} ${text}` }, { status: 502 });
  }
  const json = await res.json().catch(() => ({}));
  return NextResponse.json({ ok: true, n8n: json });
}
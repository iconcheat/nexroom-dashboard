import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const SECRET = process.env.AGENT_WEBHOOK_SECRET!;

function safeEq(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

export async function POST(req: NextRequest) {
  // 1) อ่าน "raw text" ก่อน
  const raw = await req.text();

  // 2) ดึง signature จาก header
  const sig = req.headers.get('x-agent-signature') || '';

  // 3) คำนวณ HMAC จาก raw เดิม
  const calc = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');

  // 4) เทียบแบบ timingSafeEqual
  if (!safeEq(calc, sig)) {
    return NextResponse.json({ ok: false, error: 'bad_signature' }, { status: 401 });
  }

  // 5) parse ภายหลัง (ปลอดภัยแล้ว)
  let body: any = {};
  try { body = JSON.parse(raw); } catch {}

  // ... (บันทึก log + broadcast SSE)
  return NextResponse.json({ ok: true });
}
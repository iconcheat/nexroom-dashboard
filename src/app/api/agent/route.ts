// src/app/api/agent/route.ts (Next.js App Router)
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';

const N8N_URL = process.env.N8N_URL!;               // เช่น https://your-n8n.host
const SIGNING_SECRET = process.env.N8N_SIGNING_SECRET!;

function stableStringify(obj: any) {
  const keys = new Set<string>();
  JSON.stringify(obj, (k, v) => (keys.add(k), v));
  return JSON.stringify(obj, Array.from(keys).sort());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // ใส่ context ขั้นต่ำ (กันหล่น)
    const payload = {
      message: body.message ?? '',
      context: {
        ...body.context,
        channel: body.context?.channel ?? 'dashboard',
      },
    };

    // ทำลายเซ็นเหมือน n8n node "prepare body string" + "Crypto (HMAC SHA256)"
    const bodyStr = stableStringify(payload);
    const sig = crypto.createHmac('sha256', SIGNING_SECRET).update(bodyStr).digest('hex');

    // ยิงเข้า n8n เวิร์กโฟลว์: /webhook/ai-chat
    const r = await fetch(`${N8N_URL}/webhook/ai-chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-nexroom-client': 'dashboard',
        'x-nexroom-signature': sig,
        // forward บาง header ที่มีประโยชน์ (ถ้าต้องใช้)
        'x-dorm-id': payload.context?.dorm_id ?? '',
        'x-staff-id': payload.context?.staff_id ?? '',
      },
      body: JSON.stringify({ body: payload, headers: Object.fromEntries(req.headers) }),
    });

    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (err: any) {
    console.error('[api/agent] error', err);
    return NextResponse.json({ ok: false, error: err?.message || 'internal_error' }, { status: 500 });
  }
}
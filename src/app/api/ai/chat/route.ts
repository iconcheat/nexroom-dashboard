// src/app/api/ai/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';

export const runtime = 'nodejs'; // บน Render

function stableStringify(obj: any) {
  const keys = new Set<string>(); JSON.stringify(obj, (k, v) => (keys.add(k), v));
  return JSON.stringify(obj, Array.from(keys).sort());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const N8N_URL = process.env.N8N_URL!;
    const N8N_SIGNING_SECRET = process.env.N8N_SIGNING_SECRET!;

    if (!N8N_URL || !N8N_SIGNING_SECRET) {
      return new Response(JSON.stringify({ ok:false, error:'missing_env' }), { status: 500 });
    }

    // ✅ ใช้จาก req โดยตรง
    const h = req.headers;
    const c = req.cookies;

    const ctx = {
      ...(body?.context || {}),
      staff_id:   body?.context?.staff_id   ?? h.get('x-staff-id')   ?? c.get('staff_id')?.value ?? null,
      dorm_id:    body?.context?.dorm_id    ?? h.get('x-dorm-id')    ?? c.get('dorm_id')?.value ?? null,
      dorm_name:  body?.context?.dorm_name  ?? c.get('dorm_name')?.value ?? null,
      role:       body?.context?.role       ?? c.get('role')?.value ?? 'staff',
      session_id: body?.context?.session_id ?? h.get('x-session-id') ?? c.get('session_id')?.value ?? '',
      channel:    'dashboard',
      locale:     body?.context?.locale ?? 'th-TH',
    };

    if (!ctx.staff_id) return NextResponse.json({ ok:false, error:'missing staff_id' }, { status: 400 });
    if (!ctx.dorm_id)  return NextResponse.json({ ok:false, error:'missing dorm_id' }, { status: 400 });

    const bodyForSign = { ...body, context: ctx };
    const bodyStr     = stableStringify(bodyForSign);
    const sig         = crypto.createHmac('sha256', N8N_SIGNING_SECRET).update(bodyStr).digest('hex');

    const r = await fetch(`${N8N_URL}/webhook/ai-chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-nexroom-client': 'dashboard',
        'x-nexroom-signature': sig,
        'x-dorm-id':  String(ctx.dorm_id || ''),
        'x-staff-id': String(ctx.staff_id || ''),
        'x-session-id': String(ctx.session_id || ''),
      },
      body: JSON.stringify(bodyForSign),
    });

    // ส่ง response จาก n8n กลับให้ frontend
    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { 'content-type': r.headers.get('content-type') || 'application/json' },
    });

  } catch (err: any) {
    return NextResponse.json({ ok:false, error: String(err?.message || err) }, { status: 500 });
  }
}

// กัน call ด้วย GET เผลอ ๆ
export async function GET() {
  return NextResponse.json({ ok:true, path:'/api/ai/chat' });
}
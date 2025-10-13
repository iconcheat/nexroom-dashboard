// src/app/api/ai/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import crypto from 'node:crypto';

export const runtime = 'nodejs'; // ใช้ Node runtime (Render compatible)

/**
 * AI Chat endpoint
 * ใช้เป็น bridge ระหว่างหน้าแดชบอร์ด <-> n8n
 * จะทำหน้าที่แนบ context ของผู้ใช้ และเซ็นข้อมูลด้วย secret ก่อนส่งไป n8n
 */
export async function POST(req: NextRequest) {
  try {
    // ✅ อ่านค่าจาก environment
    const N8N_URL = process.env.N8N_URL;
    const N8N_SIGNING_SECRET = process.env.N8N_SIGNING_SECRET;

    if (!N8N_URL || !N8N_SIGNING_SECRET) {
      return NextResponse.json({ ok: false, error: 'missing_env' }, { status: 500 });
    }

    // ✅ อ่าน body ที่ส่งมาจาก frontend
    const body = await req.json().catch(() => ({}));

    // ✅ อ่าน headers + cookies เพื่อดึง context ของผู้ใช้
    const h = await headers();
    const c = await cookies();

    const ctx = {
      ...(body.context || {}),
      staff_id:
        body.context?.staff_id ??
        h.get('x-staff-id') ??
        c.get('staff_id')?.value ??
        null,
      dorm_id:
        body.context?.dorm_id ??
        h.get('x-dorm-id') ??
        c.get('dorm_id')?.value ??
        null,
      dorm_name:
        body.context?.dorm_name ??
        c.get('dorm_name')?.value ??
        null,
      session_id:
        body.context?.session_id ??
        h.get('x-session-id') ??
        c.get('nxr_session')?.value ??
        null,
      role: body.context?.role ?? c.get('role')?.value ?? 'staff',
      channel: 'dashboard',
      locale: body.context?.locale ?? 'th-TH',
    };

    // ✅ ตรวจสอบว่ามี session ที่ถูกต้อง
    if (!ctx.staff_id) {
      return NextResponse.json({ ok: false, error: 'missing_staff_id' }, { status: 400 });
    }
    if (!ctx.dorm_id) {
      return NextResponse.json({ ok: false, error: 'missing_dorm_id' }, { status: 400 });
    }

    // ✅ เตรียม body ที่จะส่งไปให้ n8n
    const bodyForSign = { ...body, context: ctx };
    const bodyStr = stableStringify(bodyForSign);

    // ✅ เซ็นข้อมูลด้วย secret
    const sig = crypto.createHmac('sha256', N8N_SIGNING_SECRET).update(bodyStr).digest('hex');

    // ✅ ส่งต่อไป n8n webhook: /webhook/ai-chat
    const r = await fetch(`${N8N_URL}/webhook/ai-chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-nexroom-client': 'dashboard',
        'x-nexroom-signature': sig,
        'x-staff-id': String(ctx.staff_id || ''),
        'x-dorm-id': String(ctx.dorm_id || ''),
        'x-session-id': String(ctx.session_id || ''),
      },
      body: bodyStr,
    });

    // ✅ ส่งผลลัพธ์จาก n8n กลับไปยัง Frontend
    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: {
        'content-type': r.headers.get('content-type') || 'application/json',
      },
    });
  } catch (err: any) {
    console.error('ai/chat error:', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}

// helper สำหรับทำ JSON แบบเรียง key เพื่อให้ signature ตรงกัน
function stableStringify(obj: any) {
  const keys = new Set<string>();
  JSON.stringify(obj, (k, v) => {
    keys.add(k);
    return v;
  });
  return JSON.stringify(obj, Array.from(keys).sort());
}

// เผื่อเรียกทดสอบด้วย GET
export async function GET() {
  return NextResponse.json({ ok: true, path: '/api/ai/chat' });
}
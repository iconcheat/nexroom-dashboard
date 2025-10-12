// src/app/api/ai/chat/route.ts
import crypto from 'node:crypto';

export const runtime = 'nodejs'; // ใช้ Node runtime บน Render

function stableStringify(obj: any) {
  const keys = new Set<string>();
  JSON.stringify(obj, (k, v) => (keys.add(k), v));
  return JSON.stringify(obj, Array.from(keys).sort());
}

function sign(body: any, secret: string) {
  const bodyStr = stableStringify(body);
  return crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const N8N_URL = process.env.N8N_URL!;
    const N8N_SIGNING_SECRET = process.env.N8N_SIGNING_SECRET!;

    if (!N8N_URL || !N8N_SIGNING_SECRET) {
      return new Response(JSON.stringify({ ok:false, error:'missing_env' }), { status: 500 });
    }

    // header context (ดึงจาก client ถ้ามี)
    const dormId   = (req.headers.get('x-dorm-id') || body?.context?.dorm_id || '') as string;
    const staffId  = (req.headers.get('x-staff-id') || body?.context?.staff_id || '') as string;
    const session  = (req.headers.get('x-session-id') || body?.context?.session_id || '') as string;

    // ทำลายเซ็นแบบเดียวกับฝั่ง n8n (Crypto HMAC SHA256)
    const signature = sign(body, N8N_SIGNING_SECRET);

    const res = await fetch(`${N8N_URL}/webhook/ai-chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-nexroom-client': 'dashboard',
        'x-nexroom-signature': signature,
        'x-dorm-id': dormId,
        'x-staff-id': staffId,
        'x-session-id': session,
      },
      body: JSON.stringify(body),
    });

    // ส่งต่อผลกลับไปให้หน้าแดชบอร์ด
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok:false, error: err?.message || 'server_error' }), { status: 500 });
  }
}

// เผื่อคุณกดทดสอบด้วย GET แล้วเจอ 404
export async function GET() {
  return Response.json({ ok:true, path:'/api/ai/chat' });
}
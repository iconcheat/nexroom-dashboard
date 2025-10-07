import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const N8N_BASE = process.env.N8N_BASE!;
const N8N_SECRET = process.env.N8N_SIGNING_SECRET!;

export async function POST(req: Request) {
  try {
    const sid = (await cookies()).get('nxr_session')?.value || '';
    if (!sid) return NextResponse.json({ ok:false, error:'unauthorized' }, { status: 401 });

    const body = await req.json();
    const payload = { message: body.message, context: body.context };

    const keys = new Set<string>(); JSON.stringify(payload, (k,v)=> (keys.add(k), v));
    const bodyStr = JSON.stringify(payload, Array.from(keys).sort());
    const sig = crypto.createHmac('sha256', N8N_SECRET).update(bodyStr).digest('hex');

    const r = await fetch(`${N8N_BASE}/webhook/ai-chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-nexroom-client': 'dashboard',
        'x-nexroom-signature': sig,
        origin: 'https://nexroom-dashboard.onrender.com',
      },
      body: bodyStr,
      cache: 'no-store',
    });

    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (e:any) {
    console.error('ai_proxy_error', e);
    return NextResponse.json({ ok:false, error: e?.message || 'proxy_failed' }, { status: 500 });
  }
}
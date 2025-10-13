import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';

const N8N_URL = process.env.N8N_URL!;
const N8N_SIGNING_SECRET = process.env.N8N_SIGNING_SECRET!;

function stableStringify(obj: any) {
  const keys = new Set<string>(); JSON.stringify(obj, (k, v) => (keys.add(k), v));
  return JSON.stringify(obj, Array.from(keys).sort());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const hdr  = Object.fromEntries(req.headers); // lower-case
    const cookies = req.cookies;

    const ctx = {
      ...body.context,
      staff_id:  body?.context?.staff_id  ?? hdr['x-staff-id']  ?? cookies.get('staff_id')?.value ?? null,
      dorm_id:   body?.context?.dorm_id   ?? hdr['x-dorm-id']   ?? cookies.get('dorm_id')?.value ?? null,
      dorm_name: body?.context?.dorm_name ?? cookies.get('dorm_name')?.value ?? null,
      role:      body?.context?.role      ?? cookies.get('role')?.value ?? 'staff',
      channel:   'dashboard',
      locale:    body?.context?.locale ?? 'th-TH',
    };

    // บังคับให้มี staff_id / dorm_id
    if (!ctx.staff_id)  return NextResponse.json({ ok:false, error:'missing staff_id' }, { status: 400 });
    if (!ctx.dorm_id)   return NextResponse.json({ ok:false, error:'missing dorm_id' }, { status: 400 });

    // ทำลายเซ็น body → ตรงกับ n8n
    const bodyForSign = { ...body, context: ctx };
    const bodyStr = stableStringify(bodyForSign);
    const sig = crypto.createHmac('sha256', N8N_SIGNING_SECRET).update(bodyStr).digest('hex');

    const r = await fetch(`${N8N_URL}/webhook/ai-chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-nexroom-client': 'dashboard',
        'x-nexroom-signature': sig,
        'x-dorm-id': ctx.dorm_id ?? '',
        'x-staff-id': ctx.staff_id ?? '',
      },
      body: JSON.stringify(bodyForSign),
    });

    const data = await r.json().catch(()=>({ ok:false, error:'bad n8n json' }));
    return NextResponse.json(data, { status: r.status });

  } catch (err:any) {
    return NextResponse.json({ ok:false, error: String(err?.message || err) }, { status: 500 });
  }
}
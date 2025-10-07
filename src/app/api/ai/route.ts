import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { Pool } from 'pg';

// 👇 เพิ่มตรงนี้
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const N8N_BASE = process.env.N8N_BASE!; // e.g. https://nexroom.onrender.com
const N8N_SECRET = process.env.N8N_SIGNING_SECRET!;

export async function POST(req: Request) {
  try {
    const jar = await cookies();
    const sid = jar.get('nxr_session')?.value || '';
    if (!sid) return NextResponse.json({ ok:false, error:'unauthorized' }, { status: 401 });

    const body = await req.json();
    // ผูก context เพิ่มจากเซสชันฝั่งคุณได้ เช่น userId/dormId จาก DB ถ้าต้องการ
    const payload = {
      message: body.message,
      context: body.context, // ใช้อันเดิมของคุณ
    };

    // stable stringify
    const sorted = (obj: any) => {
      const all = new Set<string>(); JSON.stringify(obj, (k,v)=>(all.add(k),v));
      return JSON.stringify(obj, Array.from(all).sort());
    };
    const bodyStr = sorted(payload);
    const sig = crypto.createHmac('sha256', N8N_SECRET).update(bodyStr).digest('hex');

    const r = await fetch(`${N8N_BASE}/webhook/ai-chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-nexroom-client': 'dashboard',
        'x-nexroom-signature': sig,
        'origin': 'https://nexroom-dashboard.onrender.com',
      },
      body: bodyStr,
      cache: 'no-store',
    });

    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok:false, error: e?.message || 'proxy_failed' }, { status: 500 });
  }
}
// src/app/api/ai/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
export const runtime = 'nodejs';

const URL    = process.env.N8N_WEBHOOK_URL || '';
const SECRET = process.env.N8N_SIGNING_SECRET || '';
const VERIFY = (process.env.N8N_VERIFY_SIG ?? 'true').toLowerCase() !== 'false'; // ตั้ง N8N_VERIFY_SIG=false เพื่อลองข้าม HMAC

function stableStringify(obj: any) {
  const keys = new Set<string>(); JSON.stringify(obj, (k, v) => (keys.add(k), v));
  return JSON.stringify(obj, Array.from(keys).sort());
}
function sign(body: string) {
  return crypto.createHmac('sha256', SECRET).update(body).digest('hex');
}

export async function GET() {
  return NextResponse.json({ ok: true, ping: 'ai-route-alive', url: URL, verify: VERIFY });
}

export async function POST(req: NextRequest) {
  if (!URL) return NextResponse.json({ ok:false, error:'missing_N8N_WEBHOOK_URL' }, { status: 500 });
  try {
    const payload = await req.json().catch(() => ({}));
    const body = stableStringify(payload);
    const headers: Record<string, string> = { 'content-type': 'application/json', 'x-nexroom-client': 'dashboard' };
    if (VERIFY) headers['x-nexroom-signature'] = sign(body);

    const r = await fetch(URL, { method: 'POST', headers, body, cache: 'no-store', redirect: 'follow' });

    const ct = r.headers.get('content-type') || '';
    const raw = await r.text();

    // ถ้า content-type เป็น json หรือ parse ได้ ให้ส่งผ่านเลย
    if (ct.includes('application/json')) {
      try { return NextResponse.json(JSON.parse(raw), { status: r.status }); }
      catch { /* ตกมาเคส invalid_json ด้านล่าง */ }
    }
    try { return NextResponse.json(JSON.parse(raw), { status: r.status }); }
    catch {
      // ให้เห็นชัดๆ ว่า n8n ตอบอะไร (ตัดให้สั้นเพื่อความปลอดภัย)
      return NextResponse.json({
        ok: false,
        error: 'invalid_json',
        status: r.status,
        contentType: ct,
        rawSnippet: raw.slice(0, 400)
      }, { status: r.status || 502 });
    }
  } catch (e: any) {
    return NextResponse.json({ ok:false, error: e?.message || 'unknown_error' }, { status: 500 });
  }
}
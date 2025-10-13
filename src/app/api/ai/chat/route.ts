import { NextResponse, NextRequest } from 'next/server';
import * as crypto from 'node:crypto';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const N8N_URL = process.env.N8N_URL!;
    const N8N_SIGNING_SECRET = process.env.N8N_SIGNING_SECRET!;
    if (!N8N_URL || !N8N_SIGNING_SECRET) {
      return NextResponse.json({ ok:false, error:'missing_env' }, { status:500 });
    }

    // 1) headers → object ตัวพิมพ์เล็ก
    const headersLower: Record<string,string> = {};
    for (const [k, v] of req.headers as any) headersLower[k.toLowerCase()] = String(v);

    // 2) เริ่มจาก body/context + headers + cookies
    const c = req.cookies;
    let ctx = {
      ...(body?.context || {}),
      staff_id:   body?.context?.staff_id   ?? headersLower['x-staff-id']   ?? c.get('staff_id')?.value   ?? null,
      dorm_id:    body?.context?.dorm_id    ?? headersLower['x-dorm-id']    ?? c.get('dorm_id')?.value    ?? null,
      username:   body?.context?.username   ?? c.get('username')?.value      ?? null,
      role:       body?.context?.role       ?? c.get('role')?.value          ?? 'staff',
      telegram_id:body?.context?.telegram_id?? c.get('telegram_id')?.value   ?? null,
      plan_name:  body?.context?.plan_name  ?? c.get('plan_name')?.value     ?? null,
      session_id: body?.context?.session_id ?? headersLower['x-session-id']  ?? c.get('nxr_session')?.value ?? '',
      channel:    'dashboard',
      locale:     body?.context?.locale     ?? 'th-TH',
    };

    // 3) Fallback: ถ้า staff_id/dorm_id ยังว่าง ลองอ่านจาก DB ด้วย nxr_session
    if ((!ctx.staff_id || !ctx.dorm_id) && ctx.session_id) {
      try {
        const pool = getPool();
        const { rows } = await pool.query(
          `SELECT s.staff_id, s.dorm_id, u.username, u.role, u.telegram_id, u.plan_name
             FROM app.staff_sessions s
             JOIN app.staff_users u ON u.staff_id = s.staff_id
            WHERE s.session_id = $1 AND s.is_valid = true AND s.expires_at > now()
            LIMIT 1`,
          [ctx.session_id]
        );
        const v = rows[0];
        if (v) {
          ctx = {
            ...ctx,
            staff_id:   ctx.staff_id   ?? v.staff_id,
            dorm_id:    ctx.dorm_id    ?? v.dorm_id,
            username:   ctx.username   ?? v.username,
            role:       ctx.role       ?? (v.role || 'staff'),
            telegram_id:ctx.telegram_id?? v.telegram_id,
            plan_name:  ctx.plan_name  ?? v.plan_name,
          };
        }
      } catch (e) {
        console.warn('ai/chat fallback session lookup failed:', e);
      }
    }

    if (!ctx.staff_id) return NextResponse.json({ ok:false, error:'missing staff_id' }, { status:400 });
    if (!ctx.dorm_id)  return NextResponse.json({ ok:false, error:'missing dorm_id' }, { status:400 });

    // 4) ลงนามแล้วส่งต่อให้ n8n
    const bodyForSign = { ...body, context: ctx };
    const bodyStr = JSON.stringify(bodyForSign);
    const sig = crypto.createHmac('sha256', N8N_SIGNING_SECRET).update(bodyStr).digest('hex');

    const r = await fetch(`${N8N_URL}/webhook/ai-chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-nexroom-client': 'dashboard',
        'x-nexroom-signature': sig,
        'x-dorm-id':    String(ctx.dorm_id || ''),
        'x-staff-id':   String(ctx.staff_id || ''),
        'x-session-id': String(ctx.session_id || ''),
      },
      body: bodyStr,
    });

    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { 'content-type': r.headers.get('content-type') || 'application/json' },
    });
  } catch (err:any) {
    return NextResponse.json({ ok:false, error:String(err?.message || err) }, { status:500 });
  }
}
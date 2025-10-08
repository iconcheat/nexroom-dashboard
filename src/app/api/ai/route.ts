// src/app/api/ai/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { Pool } from 'pg';

const useSSL = (process.env.PGSSLMODE || '').toLowerCase() === 'require';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
});

const N8N_BASE   = process.env.N8N_BASE!;
const N8N_SECRET = process.env.N8N_SIGNING_SECRET!;

export async function POST(req: Request) {
  try {
    const sid = cookies().get('nxr_session')?.value || '';
    if (!sid) return NextResponse.json({ ok:false, error:'unauthorized' }, { status: 401 });

    const { message } = await req.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ ok:false, error:'invalid_message' }, { status: 400 });
    }

    // ดึงตัวตนจริงจาก DB
    const client = await pool.connect();
    const q = await client.query(
      `
      select
        ss.session_id,
        ss.staff_id,
        ss.dorm_id,
        su.username,
        su.full_name,
        su.role,
        su.telegram_id,
        row_to_json(d) as dorm_row
      from app.staff_sessions ss
      join app.staff_users su on su.staff_id = ss.staff_id
      left join app.dorms d on d.dorm_id = ss.dorm_id
      where ss.session_id = $1
        and ss.is_valid = true
        and ss.expires_at > now()
      limit 1
      `,
      [sid],
    );
    client.release();

    if (q.rowCount === 0) {
      return NextResponse.json({ ok:false, error:'unauthorized' }, { status: 401 });
    }

    const me = q.rows[0];
    const dormRow = (me.dorm_row ?? {}) as Record<string, any>;
    const dormName =
      dormRow.name ?? dormRow.dorm_name ?? dormRow.title ?? dormRow.dormtitle ?? '-';

    // เซิร์ฟเวอร์ประกอบ context จาก “ข้อมูลจริง”
    const payload = {
      message,
      context: {
        sid: me.session_id,
        staffId: me.staff_id,
        role: String(me.role || 'viewer').toLowerCase(),
        dormId: me.dorm_id,
        dormName,
        name: me.full_name || me.username,
        telegramId: me.telegram_id || null,
        locale: 'th-TH',
        ts: new Date().toISOString(),
      },
    };

    // stable stringify + HMAC
    const keys = new Set<string>(); JSON.stringify(payload, (k,v)=> (keys.add(k), v));
    const bodyStr = JSON.stringify(payload, Array.from(keys).sort());
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

    // ถ้า n8n ตอบ HTML/ข้อความ ให้ห่อเป็น error อ่านง่าย
    let data: any;
    const text = await r.text();
    try { data = JSON.parse(text); }
    catch { data = { ok:false, error:'invalid_json_from_n8n', raw:text }; }

    return NextResponse.json(data, { status: r.status });
  } catch (e:any) {
    console.error('ai_proxy_error', e);
    return NextResponse.json({ ok:false, error: e?.message || 'proxy_failed' }, { status: 500 });
  }
}
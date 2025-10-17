// src/app/api/ai/push/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { ssePublish } from '@/lib/bus';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

function verifyHmac(bodyRaw: string, headerSig: string | null): boolean {
  if (!headerSig) return false;
  const secret = process.env.AGENT_WEBHOOK_SECRET || '';
  if (!secret) return false;
  const calc = crypto.createHmac('sha256', secret).update(bodyRaw).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(headerSig));
}

async function findLatestSessionId(staffId: string): Promise<string | null> {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT session_id
         FROM app.staff_sessions
        WHERE staff_id = $1
          AND is_valid = true
          AND expires_at > now()
        ORDER BY created_at DESC
        LIMIT 1`,
      [staffId],
    );
    return rows[0]?.session_id ?? null;
  } catch {
    return null;
  }
}

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i; // new

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const body = raw ? JSON.parse(raw) : {};

    // ----- Auth (ของเดิม) -----
    const legacySecret = req.headers.get('x-nexroom-callback-secret') || '';
    const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const hmacSig = req.headers.get('x-agent-signature');

    const okLegacy = legacySecret && legacySecret === process.env.NEXROOM_CALLBACK_SECRET;
    const okBearer = bearer && bearer === process.env.DASH_PUSH_TOKEN;
    const okHmac = verifyHmac(raw, hmacSig);

    if (!(okLegacy || okBearer || okHmac)) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    // ----- session_id (ของเดิม) -----
    let sessionId: string | null = String(body?.session_id || '').trim() || null;
    if (!sessionId) {
      const staffId = String(body?.staff_id || body?.context?.staff_id || '').trim();
      if (staffId) sessionId = await findLatestSessionId(staffId);
    }
    if (!sessionId) {
      console.warn('[ai/push] missing session_id and cannot infer from staff_id');
      return NextResponse.json({ ok: false, error: 'missing_session_id' }, { status: 400 });
    }

    // ----- หาค่า topic / data / dorm_id ให้ครบ -----
    // แก้ไข: map event->topic ให้แน่นอน และรองรับรูปแบบเดิม
    const topic =
      String(body?.event || '').trim() ||
      String(body?.kind || '').trim() ||
      String((body?.data ?? {})?.event || '').trim() ||
      'message'; // แก้ไข

    // payload ที่จะส่ง/เก็บ
    const data = (body?.data ?? body) || {}; // แก้ไข

    // เอา dorm_id จาก body.data.dorm_id -> body.dorm_id -> header
    let dormId =
      String((body?.data ?? body)?.dorm_id || '').trim() ||
      String(body?.dorm_id || '').trim() ||
      String(req.headers.get('x-nexroom-dorm') || '').trim(); // แก้ไข

    if (!dormId || !UUID_RX.test(dormId)) {
      // new: ถ้าไม่มี dorm_id ที่เป็น UUID ให้ live push อย่างเดียว (กันล้ม)
      console.warn('[ai/push] missing/invalid dorm_id. Live-only push will be used.');
      try {
        // ฝั่งเดิม (2 args)
        (ssePublish as any)(sessionId, { event: topic, data });
      } catch {
        // ฝั่งใหม่ (เผื่อมี 4 args)
        try { (ssePublish as any)(dormId, sessionId, topic, data); } catch {}
      }
      return NextResponse.json({ ok: true, warn: 'live_only' }, { status: 200 }); // new
    }

    // ----- บันทึกลง DB ให้ตรง schema จริง -----
    try {
      const pool = getPool();
      // แก้ไข: ใส่คอลัมน์ให้ครบและ cast ตรงชนิด
      const sql = `
        INSERT INTO app.sse_events (dorm_id, session_id, topic, payload)
        VALUES ($1::uuid, $2::text, $3::text, $4::jsonb)
      `;
      await pool.query(sql, [
        dormId,
        sessionId,
        topic,
        JSON.stringify(data), // jsonb
      ]);
    } catch (e) {
      console.error('[SSE:DB] insert error', e);
      // ถ้า insert พัง ก็ยัง live push ต่อ (ไม่ให้ user เห็นล้ม) // new
    }

    // ----- Live push ไปยัง client ตอนนี้ -----
    try {
      // รองรับ signature เก่า (2 arg) และใหม่ (4 arg)
      const sp = ssePublish as unknown as (...args: any[]) => any;
      if (sp.length >= 4) {
        // new: ถ้าโปรเจ็กต์คุณมีเวอร์ชัน 4 args
        sp(dormId, sessionId, topic, data); // new
      } else {
        // เก่าของคุณ (2 args) ยังทำงานต่อ
        sp(sessionId, { event: topic, data }); // แก้ไข
      }
    } catch (e) {
      console.error('[SSE:push] live push error', e);
    }

    return new NextResponse(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}
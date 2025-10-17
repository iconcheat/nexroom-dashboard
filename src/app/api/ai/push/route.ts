// src/app/api/ai/push/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { ssePublish } from '@/lib/bus';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

/** verify HMAC(body, AGENT_WEBHOOK_SECRET) if header x-agent-signature is provided */
function verifyHmac(bodyRaw: string, headerSig: string | null): boolean {
  if (!headerSig) return false;
  const secret = process.env.AGENT_WEBHOOK_SECRET || '';
  if (!secret) return false;
  const calc = crypto.createHmac('sha256', secret).update(bodyRaw).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(headerSig));
}

// new: ดึง dorm_id จาก session_id เมื่อ header/body ไม่ส่งมา
async function findDormIdBySession(sessionId: string): Promise<string | null> { // new
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT s.dorm_id
         FROM app.staff_sessions s
        WHERE s.session_id = $1
          AND s.is_valid = true
          AND s.expires_at > now()
        LIMIT 1`,
      [sessionId],
    );
    return rows[0]?.dorm_id ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    // ต้องอ่านแบบ text ก่อนเพื่อรองรับ HMAC
    const raw = await req.text();
    const body = raw ? JSON.parse(raw) : {};

    // ----- Auth: รองรับ 3 ช่องทาง (เหมือนเดิม) -----
    const legacySecret = req.headers.get('x-nexroom-callback-secret') || '';
    const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const hmacSig = req.headers.get('x-agent-signature');

    const okLegacy = !!legacySecret && legacySecret === process.env.NEXROOM_CALLBACK_SECRET;
    const okBearer = !!bearer && bearer === process.env.DASH_PUSH_TOKEN;
    const okHmac = verifyHmac(raw, hmacSig);

    if (!(okLegacy || okBearer || okHmac)) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    // ----- Extract base fields (รองรับรูปเดิมของ n8n) -----
    const sessionId: string | null = (String(body?.session_id || '').trim() || null);
    const headerDorm = req.headers.get('x-nexroom-dorm') || '';
    const dormFromBody = String(body?.dorm_id || body?.data?.dorm_id || '').trim() || ''; // new

    // event/topic
    let topic: string =
      String(body?.event || '').trim() ||
      String(body?.kind || '').trim() ||
      'reserve_summary'; // แก้ไข: fallback เดิม

    // payload ที่จะส่งให้หน้าแดชบอร์ด
    const data = (body?.data && typeof body.data === 'object')
      ? body.data
      : body;

    if (!sessionId) {
      console.warn('[ai/push] missing session_id');
      return NextResponse.json({ ok: false, error: 'missing_session_id' }, { status: 400 });
    }

    // ----- หา dorm_id ให้ได้แน่นอน เพื่อบันทึกลง DB -----
    let dormId = (headerDorm || dormFromBody) || ''; // new
    if (!dormId) dormId = (await findDormIdBySession(sessionId)) || ''; // new

    // ----- บันทึกลง DB เพื่อใช้ replay (ถ้าหา dorm_id ไม่เจอ จะข้ามการบันทึก) -----
    try {
      if (!dormId) {
        console.warn('[ai/push] ssePublish(2) live-only push: missing dorm_id'); // new
      } else {
        const pool = getPool();
        // new: อัปเสิร์ตกันชนซ้ำ (unique: dorm_id, session_id, topic)
        await pool.query(
          `INSERT INTO app.sse_events (dorm_id, session_id, topic, payload)
           VALUES ($1::uuid, $2::text, $3::text, $4::jsonb)
           ON CONFLICT (dorm_id, session_id, topic)
           DO UPDATE SET
             payload   = EXCLUDED.payload,
             created_at = now()`,
          [dormId, sessionId, topic, data] // แก้ไข: ใช้ 4 พารามิเตอร์ถูกต้อง
        );
      }
    } catch (e: any) {
      console.error('[SSE:DB] insert/upsert error:', e?.message || e);
      // ไม่ fail งานหลัก — ยอม live-only ได้
    }

    // ----- Live push ไปยัง client ใน session นี้ (คงพฤติกรรมเดิม) -----
    // แก้ไข: ssePublish ต้องรับแค่ (sessionId, payload)
    ssePublish(dormId, sessionId, topic, data);

    return new NextResponse(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}
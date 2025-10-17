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

/** fallback หา session ล่าสุดจาก staff_id (ถ้าจำเป็น) */
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

export async function POST(req: NextRequest) {
  try {
    // ต้องอ่านแบบ text ก่อนเพื่อรองรับ HMAC
    const raw = await req.text();
    const body = raw ? JSON.parse(raw) : {};

    // ----- Auth (เหมือนเดิม) -----
    const legacySecret = req.headers.get('x-nexroom-callback-secret') || '';
    const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const hmacSig = req.headers.get('x-agent-signature');

    const okLegacy = legacySecret && legacySecret === process.env.NEXROOM_CALLBACK_SECRET;
    const okBearer = bearer && bearer === process.env.DASH_PUSH_TOKEN;
    const okHmac = verifyHmac(raw, hmacSig);
    if (!(okLegacy || okBearer || okHmac)) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    // ----- หา session_id -----
    let sessionId: string | null = String(body?.session_id || '').trim() || null;
    if (!sessionId) {
      const staffId = String(body?.staff_id || body?.context?.staff_id || '').trim();
      if (staffId) sessionId = await findLatestSessionId(staffId);
    }
    if (!sessionId) {
      console.warn('[ai/push] missing session_id and cannot infer from staff_id');
      return NextResponse.json({ ok: false, error: 'missing_session_id' }, { status: 400 });
    }

    // ----- สร้างค่าที่จะ push -----
    // แก้ไข: map ชื่อ event/kind → topic ให้ชัด
    const topic: string =
      String(body?.event || '').trim()
      || (String(body?.kind || '').startsWith('booking') ? 'reserve_summary' : '')
      || 'message';

    // แก้ไข: รูปแบบ data ที่ฝั่ง client ใช้จริง = { event, data }
    const data = body?.data ?? body;

    // new: ดึง dorm_id ได้ 3 ทาง
    const dormId =
      String(body?.dorm_id || '').trim()
      || String(req.headers.get('x-nexroom-dorm') || '').trim()
      || String((body?.data ?? body)?.dorm_id || '').trim()
      || '';

    // ----- อแดปเตอร์: รองรับทั้ง ssePublish(4 args) และ (2 args) -----
    const sp = ssePublish as unknown as (...args: any[]) => any;

    if (typeof sp === 'function' && sp.length >= 4) {
      // ✅ เคสโปรเจกต์ที่คาดหวัง 4 อาร์กิวเมนต์ (DB+NOTIFY อยู่ในฟังก์ชันแล้ว)
      // // new: ให้ dormId เป็นค่าว่างไม่ได้ → ถ้าไม่มีให้ข้ามด้วยการโยน live-only (ด้านล่าง) แทน
      if (dormId) {
        await sp(dormId, sessionId, topic, data); // //new
      } else {
        console.warn('[ai/push] ssePublish(4) requires dorm_id. Fallback to live-only push.');
        // live-only
        sp(sessionId, { event: topic, data }); // @ts-ignore  //new: บาง impl รองรับ 2 args ด้วย
      }
    } else {
      // ✅ เคสเวอร์ชันเก่า (2 อาร์กิวเมนต์) — ใส่กันล้ม NOT NULL ให้ DB เอง
      try {
        if (dormId) {
          const pool = getPool();
          await pool.query(
            `INSERT INTO app.sse_events (dorm_id, session_id, topic, payload)
             VALUES ($1, $2, $3, $4::jsonb)`,
            [dormId, sessionId, topic, JSON.stringify(data)],
          );
        } else {
          console.warn('[ai/push] skip DB insert: missing dorm_id (live push only)');
        }
      } catch (e) {
        console.error('[SSE:DB] insert error', e);
        // ไม่ให้ 500 — ยัง live push ต่อ
      }
      sp(sessionId, { event: topic, data }); // //แก้ไข: รูปแบบ payload ที่ client รออยู่
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
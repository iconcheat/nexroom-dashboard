// src/app/api/ai/push/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { ssePublish } from '@/lib/bus';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

/* ==========================================================
   1️⃣ ตรวจสอบลายเซ็น HMAC (สำหรับ webhook จาก Agent)
   ========================================================== */
function verifyHmac(bodyRaw: string, headerSig: string | null): boolean {
  if (!headerSig) return false;
  const secret = process.env.AGENT_WEBHOOK_SECRET || '';
  if (!secret) return false;
  const calc = crypto.createHmac('sha256', secret).update(bodyRaw).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(headerSig));
  } catch {
    return false;
  }
}

/* ==========================================================
   2️⃣ fallback หา session ล่าสุดจาก staff_id (ถ้าไม่มีส่งมา)
   ========================================================== */
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
  } catch (err) {
    console.error('[findLatestSessionId] error:', err);
    return null;
  }
}

/* ==========================================================
   3️⃣ main: push event → ส่งเข้าระบบ SSE (Postgres version)
   ========================================================== */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const body = raw ? JSON.parse(raw) : {};

    // ----- Auth -----
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

    // ===== NEW: เตรียมพารามิเตอร์สำหรับ ssePublish ใหม่ =====
    const dormId =
      String(body?.dorm_id || body?.context?.dorm_id || '').trim();
    const topic =
      String(body?.event || body?.topic || 'generic').trim();
    const data =
      body?.data !== undefined ? body.data : body;

    if (!dormId) {
      return NextResponse.json({ ok: false, error: 'missing_dorm_id' }, { status: 400 });
    }

    // ----- Push event ไปยัง SSE channel ของ session นี้ (และบันทึก snapshot) -----
    await ssePublish(dormId, sessionId, topic, data);

    return new NextResponse(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (e: any) {
    console.error('[ai/push] error:', e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
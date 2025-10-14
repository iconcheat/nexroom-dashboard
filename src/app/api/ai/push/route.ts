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

    // ----- Auth: รองรับ 3 ช่องทาง -----
    const legacySecret = req.headers.get('x-nexroom-callback-secret') || '';
    const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const hmacSig = req.headers.get('x-agent-signature'); // ถ้ามีจะตรวจ HMAC

    const okLegacy = legacySecret && legacySecret === process.env.NEXROOM_CALLBACK_SECRET;
    const okBearer = bearer && bearer === process.env.DASH_PUSH_TOKEN;
    const okHmac = verifyHmac(raw, hmacSig);

    if (!(okLegacy || okBearer || okHmac)) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    // ----- หา session_id -----
    let sessionId: string | null =
      String(body?.session_id || '').trim() || null;

    if (!sessionId) {
      const staffId = String(body?.staff_id || body?.context?.staff_id || '').trim();
      if (staffId) {
        sessionId = await findLatestSessionId(staffId);
      }
    }

    if (!sessionId) {
      // ไม่ทิ้งงาน แต่แจ้งเตือนชัดเจน (dev จะเห็น log)
      console.warn('[ai/push] missing session_id and cannot infer from staff_id');
      return NextResponse.json({ ok: false, error: 'missing_session_id' }, { status: 400 });
    }

    // ----- Push event ไปยัง SSE channel ของ session นี้ -----
    // body สามารถเป็น { message, actions?, kind?, money?, ... }
    ssePublish(sessionId, body);

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
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

async function findDormIdBySession(sessionId: string): Promise<string | null> {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT dorm_id FROM app.staff_sessions
        WHERE session_id = $1 AND is_valid = true AND expires_at > now()
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
    const raw = await req.text();
    const body = raw ? JSON.parse(raw) : {};

    const legacySecret = req.headers.get('x-nexroom-callback-secret') || '';
    const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const hmacSig = req.headers.get('x-agent-signature');

    const okLegacy = !!legacySecret && legacySecret === process.env.NEXROOM_CALLBACK_SECRET;
    const okBearer = !!bearer && bearer === process.env.DASH_PUSH_TOKEN;
    const okHmac = verifyHmac(raw, hmacSig);

    if (!(okLegacy || okBearer || okHmac)) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const sessionId = String(body?.session_id || '').trim();
    if (!sessionId) {
      console.warn('[ai/push] missing session_id');
      return NextResponse.json({ ok: false, error: 'missing_session_id' }, { status: 400 });
    }

    const headerDorm = req.headers.get('x-nexroom-dorm') || '';
    const dormFromBody = String(body?.dorm_id || body?.data?.dorm_id || '').trim();
    let dormId = headerDorm || dormFromBody || (await findDormIdBySession(sessionId)) || '';

    const topic =
      String(body?.event || '').trim() ||
      String(body?.kind || '').trim() ||
      'reserve_summary';

    const data = (body?.data && typeof body.data === 'object') ? body.data : body;

    // ----- DB insert/upsert -----
    try {
      if (!dormId) {
        console.warn('[ai/push] live-only push: missing dorm_id');
      } else {
        const pool = getPool();
        await pool.query(
          `INSERT INTO app.sse_events (dorm_id, session_id, topic, payload)
           VALUES ($1::uuid, $2::text, $3::text, $4::jsonb)
           ON CONFLICT (dorm_id, session_id, topic)
           DO UPDATE SET payload = EXCLUDED.payload, created_at = now()`,
          [dormId, sessionId, topic, data]
        );
      }
    } catch (e: any) {
      console.error('[SSE:DB] insert/upsert error:', e?.message || e);
    }

    // ----- Live push -----
    await ssePublish(dormId, sessionId, topic, data);

    return new NextResponse(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
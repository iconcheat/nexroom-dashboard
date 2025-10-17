// src/app/api/ai/push/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { ssePublish } from '@/lib/bus';     // แก้ไข: ใช้ลายเซ็นใหม่ (4 args)
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

// verify HMAC(body, AGENT_WEBHOOK_SECRET) if header x-agent-signature is provided
function verifyHmac(bodyRaw: string, headerSig: string | null): boolean {
  if (!headerSig) return false;
  const secret = process.env.AGENT_WEBHOOK_SECRET || '';
  if (!secret) return false;
  const calc = crypto.createHmac('sha256', secret).update(bodyRaw).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(headerSig));
}

// fallback หา session ล่าสุดจาก staff_id (ถ้าจำเป็น)
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
    const raw = await req.text();
    const body = raw ? JSON.parse(raw) : {};

    // ----- Auth (legacy / bearer / hmac) -----
    const legacySecret = req.headers.get('x-nexroom-callback-secret') || '';
    const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const hmacSig = req.headers.get('x-agent-signature');

    const okLegacy = legacySecret && legacySecret === process.env.NEXROOM_CALLBACK_SECRET;
    const okBearer = bearer && bearer === process.env.DASH_PUSH_TOKEN;
    const okHmac   = verifyHmac(raw, hmacSig);

    if (!(okLegacy || okBearer || okHmac)) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    // ----- หา session_id -----
    let sessionId: string | null =
      String(body?.session_id || '').trim()
      || (req.headers.get('x-session-id') || '').trim()   // new: เผื่อส่งมาใน header
      || null;

    if (!sessionId) {
      const staffId = String(body?.staff_id || body?.context?.staff_id || '').trim();
      if (staffId) sessionId = await findLatestSessionId(staffId);
    }
    if (!sessionId) {
      console.warn('[ai/push] missing session_id and cannot infer from staff_id');
      return NextResponse.json({ ok: false, error: 'missing_session_id' }, { status: 400 });
    }

    // ----- หา dorm_id (ยืดหยุ่น) -----
    const dormId =
      body?.dorm_id
      || body?.context?.dorm_id
      || req.headers.get('x-nexroom-dorm')
      || null;

    // ----- กำหนด topic (event) และ data -----
    let topic = String(body?.event || '').trim();
    if (!topic && typeof body?.kind === 'string') {
      const map: Record<string,string> = {
        'booking.completed': 'reserve_summary',
        'payment.done':      'payment_done',
      };
      topic = map[body.kind] || body.kind;
    }
    if (!topic) topic = 'message';

    // เลือก data ที่จะส่งไป panel
    const data =
      body?.data ??
      body?.result ??
      {
        // fallback ใส่บางฟิลด์ที่คุ้นเคย
        message: body?.message ?? '',
        actions: Array.isArray(body?.actions) ? body.actions : [],
        booking_id: body?.booking_id ?? null,
        dorm_id: dormId ?? null,
        room_no: body?.room_no ?? null,
        submission_id: body?.submission_id ?? null,
        start_date: body?.start_date ?? null,
        money: body?.money ?? {},
      };

    // ----- กระจาย + บันทึก -----
    await ssePublish(dormId, sessionId, topic, data); // แก้ไข: ส่ง 4 อาร์กิวเมนต์

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
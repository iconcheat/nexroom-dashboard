// src/lib/bus.ts
import type { NextRequest } from 'next/server';
import { getPool } from '@/lib/db';   // สำหรับบันทึก event ลง DB (replay/notify)

// ======================= In-memory channels (per instance) =======================
type Client = {
  id: string;                    // โดยมากคือ session_id
  write: (chunk: string) => void;
  close: () => void;
};

const channels = new Map<string, Set<Client>>(); // key = channelId (session_id หรือ dorm_id ก็ได้)

// ================================ Subscribe / Unsubscribe ================================
export function sseSubscribe(channelId: string, client: Client) {
  let set = channels.get(channelId);
  if (!set) { set = new Set(); channels.set(channelId, set); }
  set.add(client);
  return () => {
    set!.delete(client);
    if (!set!.size) channels.delete(channelId);
  };
}

// ====================================== Publish ======================================
/**
 * Multi-tenant: broadcast ไปทั้ง session และ dorm
 *  - dormId     : ห้องพัก/ตึก (ใช้สำหรับ replay และช่องสัญญาณระดับหอ)
 *  - sessionId  : session ปัจจุบัน (ช่องสัญญาณของผู้ใช้)
 *  - topic      : ชื่อ event (เช่น 'reserve_summary')
 *  - data       : payload (object ที่แสดงในแดชบอร์ด)
 */
export async function ssePublish(
  dormId: string,
  sessionId: string,
  topic: string,
  data: any
): Promise<void> {
  // เตรียมแพ็กเก็ตแบบ "named SSE event"
  const packet =
    `event: ${topic}\n` +
    `data: ${JSON.stringify(data)}\n\n`;

  // 1) ส่งให้ผู้ฟังช่อง session
  const setSession = channels.get(sessionId);
  if (setSession) {
    for (const c of setSession) {
      try { c.write(packet); } catch {}
    }
  }

  // 1.1) ส่งให้ผู้ฟังช่อง dorm (ถ้ามี)
  const setDorm = channels.get(dormId);
  if (setDorm) {
    for (const c of setDorm) {
      try { c.write(packet); } catch {}
    }
  }

  // 2) บันทึกลง DB เพื่อใช้ replay / cross-instance notify
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO app.sse_events (dorm_id, session_id, topic, payload)
       VALUES ($1::uuid, $2::text, $3::text, $4::jsonb)`,
      [dormId, sessionId, topic, JSON.stringify(data)]
    );
    // ถ้าใช้ LISTEN/NOTIFY
    await pool.query(`NOTIFY sse_notify, $1`, [
      JSON.stringify({ dorm_id: dormId, session_id: sessionId, topic }),
    ]);
  } catch (e) {
    console.error('[SSE:DB]', e);
  }
}

// ================================== Helpers: extract session id ==================================
function getCookieVal(raw: string, key: string): string | null {
  const m = raw.match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** อ่าน session_id จาก query/header/cookie (รองรับหลายชื่อ) */
export function extractSessionId(req: NextRequest | Request): string | null {
  // 1) query
  try {
    const u = new URL((req as any).url || '', 'http://x');
    const q = (u.searchParams.get('session_id') || u.searchParams.get('sid') || '').trim();
    if (q) return q;
  } catch {}

  // 2) headers
  const fromHeader = (req.headers.get('x-nexroom-session') || req.headers.get('x-session-id') || '').trim();
  if (fromHeader) return fromHeader;

  // 3) NextRequest cookies API (ถ้ามี)
  const cApi = (req as any).cookies;
  if (cApi?.get) {
    const nxr = cApi.get('nxr_session')?.value;
    if (nxr) return nxr;
    const sid = cApi.get('session_id')?.value;
    if (sid) return sid;
  }

  // 4) raw Cookie header
  const raw = req.headers.get('cookie') || '';
  if (!raw) return null;

  return (
    getCookieVal(raw, 'nxr_session') ||
    getCookieVal(raw, 'session_id') ||
    null
  );
}
// src/lib/bus.ts
import type { NextRequest } from 'next/server';
import { getPool } from '@/lib/db';   // สำหรับบันทึก event ลง DB

// =======================================================
// ===== In-memory channel (ต่อ instance) =====
type Client = {
  id: string;                    // session_id
  write: (chunk: string) => void;
  close: () => void;
};

const channels = new Map<string, Set<Client>>();

// =======================================================
// ===== Subscribe / Publish =====
export function sseSubscribe(sessionId: string, client: Client) {
  let set = channels.get(sessionId);
  if (!set) { set = new Set(); channels.set(sessionId, set); }
  set.add(client);
  return () => {
    set!.delete(client);
    if (!set!.size) channels.delete(sessionId);
  };
}

/**
 * Multi-tenant version — รองรับ dorm หลายแห่ง
 * @param dormId     หอพัก
 * @param sessionId  session ปัจจุบัน
 * @param topic      ชื่อ event เช่น "reserve_summary"
 * @param data       payload ที่ต้องการส่ง
 */
export async function ssePublish(
  dormId: string,
  sessionId: string,
  topic: string,
  data: any
): Promise<void> {
  // --- 1) push event ไปยัง client ที่เปิดอยู่ใน instance นี้ ---
  const payload = { event: topic, data };
  const packet = `data: ${JSON.stringify(payload)}\n\n`;

  // ส่งถึง session
  const setSession = channels.get(sessionId);
  if (setSession) {
    for (const c of setSession) {
      try { c.write(packet); } catch {}
    }
  }

  // ส่งถึง dorm (ถ้ามี listener)
  const setDorm = channels.get(dormId);
  if (setDorm) {
    for (const c of setDorm) {
      try { c.write(packet); } catch {}
    }
  }

  // --- 2) บันทึก event ลงฐานข้อมูล เพื่อใช้ replay/notify ---
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO app.sse_events (dorm_id, session_id, topic, payload)
       VALUES ($1::uuid, $2::text, $3::text, $4::jsonb)
       ON CONFLICT (dorm_id, session_id, topic)
       DO UPDATE SET payload = EXCLUDED.payload, created_at = now()`,
      [dormId, sessionId, topic, data]
    );
    // แจ้ง instance อื่น ๆ ถ้ามี listener
    await pool.query(`NOTIFY sse_notify, $1`, [
      JSON.stringify({ dorm_id: dormId, session_id: sessionId, topic }),
    ]);
  } catch (e) {
    console.error('[SSE:DB]', e);
  }
}

// =======================================================
// ===== Extract Session ID =====
function getCookieVal(raw: string, key: string): string | null {
  const m = raw.match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function extractSessionId(req: NextRequest | Request): string | null {
  try {
    const u = new URL((req as any).url || '', 'http://x');
    const q =
      (u.searchParams.get('session_id') ||
       u.searchParams.get('sid') ||
       ''
      ).trim();
    if (q) return q;
  } catch {}

  const fromHeader =
    (req.headers.get('x-nexroom-session') ||
     req.headers.get('x-session-id') ||
     ''
    ).trim();
  if (fromHeader) return fromHeader;

  const cApi = (req as any).cookies;
  if (cApi?.get) {
    const nxr = cApi.get('nxr_session')?.value;
    if (nxr) return nxr;
    const sid = cApi.get('session_id')?.value;
    if (sid) return sid;
  }

  const raw = req.headers.get('cookie') || '';
  if (!raw) return null;

  return (
    getCookieVal(raw, 'nxr_session') ||
    getCookieVal(raw, 'session_id') ||
    null
  );
}
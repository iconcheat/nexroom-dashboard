// src/lib/bus.ts
import type { NextRequest } from 'next/server';
import { getPool } from '@/lib/db'; // new

// ===== In-memory channels per session_id =====
type Client = {
  id: string;                    // session_id
  write: (chunk: string) => void;
  close: () => void;
};
const channels = new Map<string, Set<Client>>(); // key = session_id

export function sseSubscribe(sessionId: string, client: Client) {
  let set = channels.get(sessionId);
  if (!set) { set = new Set(); channels.set(sessionId, set); }
  set.add(client);
  return () => {
    set!.delete(client);
    if (!set!.size) channels.delete(sessionId);
  };
}

// --- แก้ไข: เปลี่ยนลายเซ็นให้รองรับ (dorm_id, session_id, topic, data)
export async function ssePublish(
  dorm_id: string | null,            // new
  session_id: string,                // new
  topic: string,                     // new
  data: any                          // new
): Promise<void> {
  // 1) บันทึกลง DB เพื่อให้ route /api/ai/events รีเพลย์ได้ (optional)
  try {
    const pool = getPool();
    await pool.query(
      `insert into app.sse_events (dorm_id, session_id, topic, payload)
       values ($1, $2, $3, $4)`,
      [dorm_id || null, session_id, topic, data],
    );
  } catch (e) {
    console.warn('[SSE] insert sse_events fail:', e);
  }

  // 2) กระจายสดให้ client ที่ต่ออยู่ใน session นั้น
  const set = channels.get(session_id);
  if (!set) return;
  const payload = { event: topic, data };
  const frame = `data: ${JSON.stringify(payload)}\n\n`;
  for (const c of set) {
    try { c.write(frame); } catch {}
  }
}

// ===== Utilities =====
export function extractSessionId(req: NextRequest | Request): string | null {
  const fromApi =
    // @ts-ignore – บาง runtime เป็น NextRequest ที่มี cookies.get
    (req as any).cookies?.get?.('nxr_session')?.value as string | undefined;
  if (fromApi && typeof fromApi === 'string') return fromApi;

  const cookie = req.headers.get('cookie') || '';
  if (!cookie) return null;

  const part = cookie
    .split(';')
    .map(s => s.trim())
    .find(s => s.startsWith('nxr_session='));

  if (!part) return null;
  const [, val = ''] = part.split('=');
  return decodeURIComponent(val) || null;
}
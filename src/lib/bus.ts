// src/lib/bus.ts
import type { NextRequest } from 'next/server';
import pg from 'pg';                         // new
import { getPool } from '@/lib/db';          // new

type Client = {
  id: string;                    // session_id
  write: (chunk: string) => void;
  close: () => void;
};

// เก็บผู้ฟังราย session_id (เฉพาะภายใน instance นี้)
const channels = new Map<string, Set<Client>>(); // key = session_id

// ===== Postgres LISTEN/NOTIFY (หนึ่ง listener ต่อ instance) =====
let _listenerClient: pg.PoolClient | null = null;     // new
const LISTEN_CHANNEL = 'sse_bus';                     // new

async function ensurePgListener() {                   // new
  if (_listenerClient) return;
  const client = await getPool().connect();
  await client.query('LISTEN ' + LISTEN_CHANNEL);
  client.on('notification', (msg) => {
    if (!msg?.payload) return;
    try {
      const { session_id, topic, data } = JSON.parse(msg.payload);
      const set = channels.get(session_id);
      if (!set || set.size === 0) return;
      const envelope = { event: topic, data };
      const chunk = `data: ${JSON.stringify(envelope)}\n\n`;
      for (const c of set) { try { c.write(chunk); } catch {} }
    } catch (e) {
      console.error('[SSE] notification parse error:', e);
    }
  });
  client.on('error', (err) => {
    console.error('[SSE] listener error:', err);
    _listenerClient = null; // ให้สร้างใหม่รอบหน้า
  });
  _listenerClient = client;
}

export function sseSubscribe(sessionId: string, client: Client) {
  let set = channels.get(sessionId);
  if (!set) { set = new Set(); channels.set(sessionId, set); }
  set.add(client);

  // ให้แน่ใจว่ามี listener Postgres ทำงานอยู่เสมอ
  ensurePgListener().catch(err => console.error('[SSE] listen fail', err));

  return () => {
    set!.delete(client);
    if (!set!.size) channels.delete(sessionId);
  };
}

/** กระจายอีเวนต์ (บันทึกลง DB + NOTIFY ทุก instance) */
export async function ssePublish(
  dorm_id: string,            // new
  session_id: string,         // new
  topic: string,              // เช่น 'reserve_summary' | 'payment_done'
  data: any,                  // payload
) {
  try { console.log('[SSE:PUBLISH]', session_id, topic); } catch {}
  const pool = getPool();

  // 1) อัปเดต snapshot ล่าสุดไว้เพื่อ replay ตอนรีเฟรช
  await pool.query(
    `insert into app.sse_events (dorm_id, session_id, topic, payload)
       values ($1, $2, $3, $4::jsonb)
     on conflict (dorm_id, session_id, topic)
     do update set payload = excluded.payload, created_at = now()`,
    [dorm_id, session_id, topic, JSON.stringify(data)]
  );

  // 2) แจ้งทุก instance ผ่าน NOTIFY
  await pool.query(
    `select pg_notify($1, $2)`,
    [LISTEN_CHANNEL, JSON.stringify({ session_id, topic, data })]
  );

  // 3) ส่งทันทีให้ client ใน instance เดียวกัน (ลด latency)
  const set = channels.get(session_id);
  if (set && set.size) {
    const envelope = { event: topic, data };
    const chunk = `data: ${JSON.stringify(envelope)}\n\n`;
    for (const c of set) { try { c.write(chunk); } catch {} }
  }
}

/** อ่าน session_id จาก cookie หรือ header; รองรับทั้ง NextRequest และ fetch Request */
export function extractSessionId(req: NextRequest | Request): string | null {
  // 1) NextRequest.cookies().get() (App Router)
  const fromApi =
    // @ts-ignore – บาง runtime เป็น NextRequest ที่มี cookies.get
    (req as any).cookies?.get?.('nxr_session')?.value as string | undefined;
  if (fromApi && typeof fromApi === 'string') return fromApi;

  // 2) raw Cookie header
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
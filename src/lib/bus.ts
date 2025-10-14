// src/lib/bus.ts
import type { NextRequest } from 'next/server';

type Client = {
  id: string;                    // session_id
  write: (chunk: string) => void;
  close: () => void;
};

// เก็บผู้ฟังราย session_id
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

/** กระจาย payload ไปยังทุก client ใน session นั้น ๆ */
export function ssePublish(sessionId: string, payload: any) {
  const set = channels.get(sessionId);
  if (!set) return;
  // debug เล็กน้อย
  try { console.log('[SSE:PUSH]', sessionId, Object.keys(payload || {})); } catch {}
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const c of set) {
    try { c.write(data); } catch { /* ignore single client error */ }
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
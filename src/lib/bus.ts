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
  try { console.log('[SSE:PUSH]', sessionId, Object.keys(payload || {})); } catch {}
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const c of set) {
    try { c.write(data); } catch {}
  }
}

// ===== helpers =====
function getCookieVal(rawCookie: string, key: string): string | null {
  if (!rawCookie) return null;
  const m = rawCookie.match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** อ่าน session_id จาก query/header/cookie; รองรับได้หลายชื่อ */
export function extractSessionId(req: NextRequest | Request): string | null {
  // // new: query และ header ที่รองรับ
  try {
    const u = new URL((req as any).url || '', 'http://x');
    const q = (u.searchParams.get('session_id') || u.searchParams.get('sid') || '').trim();
    if (q) return q;
  } catch {}

  const fromHeader =
    (req.headers.get('x-nexroom-session') ||
     req.headers.get('x-session-id') ||
     '').trim();
  if (fromHeader) return fromHeader;

  // 1) NextRequest.cookies().get() (บาง runtime)
  // แก้ไข: รองรับทั้ง nxr_session และ session_id
  const anyCookies = (req as any).cookies?.get?.bind?.((req as any).cookies);
  if (anyCookies) {
    const nxr = (req as any).cookies.get('nxr_session')?.value;
    if (nxr) return nxr;
    const sid = (req as any).cookies.get('session_id')?.value;   // new
    if (sid) return sid;
  }

  // 2) raw Cookie header
  const cookie = req.headers.get('cookie') || '';
  if (!cookie) return null;

  // แก้ไข: ลองหลายชื่อ
  return (
    getCookieVal(cookie, 'nxr_session') ||
    getCookieVal(cookie, 'session_id') ||     // new
    null
  );
}
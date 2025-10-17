// src/lib/bus.ts
import type { NextRequest } from 'next/server';

// ===== Types =====
type Client = {
  id: string;                           // session_id
  write: (chunk: string) => void;
  close: () => void;
};

// ===== In-memory channels (ต่อ 1 instance) =====
const channels = new Map<string, Set<Client>>(); // key = session_id

/** สมัครรับอีเวนต์ของ session นั้น ๆ */
export function sseSubscribe(sessionId: string, client: Client) {
  let set = channels.get(sessionId);
  if (!set) { set = new Set(); channels.set(sessionId, set); }
  set.add(client);
  return () => {
    set!.delete(client);
    if (!set!.size) channels.delete(sessionId);
  };
}

/** กระจาย payload ไปยังทุก client ใน session นั้น ๆ (ไม่ผูกกับรูปแบบของ n8n) */
export function ssePublish(sessionId: string, payload: any) {
  const set = channels.get(sessionId);
  if (!set) return;

  // new: log key เพื่อดีบักแต่ไม่พ่น payload ยาว ๆ
  try { console.log('[SSE:PUSH]', sessionId, Object.keys(payload || {})); } catch {}

  // แก้ไข: ส่งเป็น Server-Sent Events มาตรฐาน
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const c of set) {
    try { c.write(data); } catch { /* ignore per-client error */ }
  }
}

// ===== helpers =====
// new: อ่านค่า cookie ชื่อใดชื่อหนึ่งจาก raw Cookie header
function getCookieVal(rawCookie: string, key: string): string | null {
  if (!rawCookie) return null;
  // ป้องกัน ; และช่องว่าง
  const m = rawCookie.match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * อ่าน session_id จาก query/header/cookie; รองรับหลายชื่อ
 * - query:  ?session_id=...  หรือ ?sid=...
 * - header: x-nexroom-session / x-session-id
 * - cookie: nxr_session / session_id (รองรับทั้งแบบ NextRequest.cookies และ raw header)
 */
export function extractSessionId(req: NextRequest | Request): string | null {
  // new: ลองอ่านจาก query ก่อน (ถ้ามี URL)
  try {
    const u = new URL((req as any).url || '', 'http://x');
    const q =
      (u.searchParams.get('session_id') ||
       u.searchParams.get('sid') ||                 // new
       ''
      ).trim();
    if (q) return q;
  } catch { /* ไม่มี URL ก็ข้าม */ }

  // new: header เผื่อยิงจาก n8n หรือ curl
  const fromHeader =
    (req.headers.get('x-nexroom-session') ||
     req.headers.get('x-session-id') ||            // new
     ''
    ).trim();
  if (fromHeader) return fromHeader;

  // แก้ไข: รองรับทั้ง App Router (NextRequest.cookies) และ raw header
  // 1) NextRequest.cookies().get()
  const cApi = (req as any).cookies;
  if (cApi?.get) {
    const nxr = cApi.get('nxr_session')?.value;
    if (nxr) return nxr;
    const sid = cApi.get('session_id')?.value;     // new
    if (sid) return sid;
  }

  // 2) raw Cookie header
  const raw = req.headers.get('cookie') || '';
  if (!raw) return null;

  // new: ลองสองชื่อ
  return (
    getCookieVal(raw, 'nxr_session') ||
    getCookieVal(raw, 'session_id') ||             // new
    null
  );
}
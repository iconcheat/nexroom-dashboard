// src/lib/bus.ts
import type { NextRequest } from 'next/server';

type Client = {
  id: string;              // session_id
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

export function ssePublish(sessionId: string, payload: any) {
  const set = channels.get(sessionId);
  if (!set) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const c of set) {
    try { c.write(data); } catch { /* ignore */ }
  }
}

// ช่วยอ่าน session_id จาก cookie/header
export function extractSessionId(req: NextRequest | Request) {
  const cookieHeader =
    (req as any).cookies?.get?.('nxr_session')?.value ??
    (req.headers.get('cookie') || '');

  if (!cookieHeader) return null;

  const sid = cookieHeader
    .split(';')
    .map((x: string) => x.trim())                 // 👈 เพิ่ม :string
    .map((x: string) => x.split('='))             // 👈 เพิ่ม :string
    .find(([k, _v]: [string, string]) => k === 'nxr_session')?.[1] || null; // 👈 ระบุ tuple type

  return sid;
}
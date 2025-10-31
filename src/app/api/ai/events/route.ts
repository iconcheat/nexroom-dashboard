// src/app/api/ai/events/route.ts
import { NextRequest } from 'next/server';
import { sseSubscribe, extractSessionId } from '@/lib/bus';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('session_id');
  const dormId = url.searchParams.get('dorm_id') || '';
  const sid = fromQuery || extractSessionId(req);

  if (!sid) return new Response('missing session', { status: 401 });

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let closed = false;
      let ping: NodeJS.Timeout | null = null;

      // ---- cleanup รวมศูนย์ ----
      let unsubSession: (() => void) | null = null;
      let unsubDorm: (() => void) | null = null;
      const cleanup = () => {
        if (closed) return;
        closed = true;
        try { if (ping) clearInterval(ping); } catch {}
        try { unsubSession?.(); } catch {}
        try { unsubDorm?.(); } catch {}
        try { controller.close(); } catch {}
      };

      // ---- เขียนแบบปลอดภัย ----
      const safeWrite = (s: string) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(s));
        } catch {
          // ถ้าช่องปิดไปแล้วให้ปิดงานเงียบ ๆ
          cleanup();
        }
      };

      // helper: ส่ง event ในรูปแบบ SSE มาตรฐาน
      const emit = (event: string, data: any) => {
        safeWrite(`event: ${event}\n`);
        safeWrite(
          `data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`
        );
      };

      // ---- เปิดสตรีม + (option) นโยบาย reconnect ของ browser ----
      emit('open', { ok: true });
      // safeWrite('retry: 15000\n\n'); // ถ้าต้องการให้ browser reconnect ทุก 15s (คง logic เดิมไว้ จึงคอมเมนต์)

      // ---- replay (ล่าสุดก่อน) ----
      try {
        const pool = getPool();
        const rs = await pool.query(
          `SELECT topic, payload
             FROM app.sse_events
            WHERE session_id = $1
            ORDER BY created_at DESC
            LIMIT 20`,
          [sid]
        );
        for (const r of rs.rows) {
          emit(r.topic, r.payload);
        }
      } catch (e) {
        console.error('[SSE] replay error', e);
      }

      // ---- subscribe: session เสมอ ----
      unsubSession = sseSubscribe(sid, {
        id: sid,
        // publisher ฝั่ง bus อาจส่งสตริงที่ฟอร์แมต SSE มาอยู่แล้ว → เขียนทิ้งดิบ ๆ ได้
        write: (s: string) => safeWrite(s),
        close: cleanup,
      });

      // ---- subscribe: dorm ถ้ามี ----
      if (dormId && dormId !== sid) {
        unsubDorm = sseSubscribe(dormId, {
          id: dormId,
          write: (s: string) => safeWrite(s),
          close: cleanup,
        });
      }

      // ---- keep-alive ----
      ping = setInterval(() => emit('ping', {}), 25_000);

      // ---- เมื่อ client ปิดการเชื่อมต่อ ----
      (req as any).signal?.addEventListener?.('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'connection': 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
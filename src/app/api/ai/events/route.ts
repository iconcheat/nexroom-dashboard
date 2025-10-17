// src/app/api/ai/events/route.ts
import { NextRequest } from 'next/server';
import { sseSubscribe, extractSessionId } from '@/lib/bus';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('session_id');
  const dormId   = url.searchParams.get('dorm_id') || '';
  const sid      = fromQuery || extractSessionId(req);

  if (!sid) return new Response('missing session', { status: 401 });

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const write = (s: string) => controller.enqueue(enc.encode(s));

      // เปิดสตรีม
      write(`event: open\ndata: ${JSON.stringify({ ok: true })}\n\n`);

      // --- replay (ล่าสุดก่อน) ---
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
          write(`event: ${r.topic}\n` + `data: ${JSON.stringify(r.payload)}\n\n`);
        }
      } catch (e) {
        console.error('[SSE] replay error', e);
      }

      // subscribe: session เสมอ
      const unsubSession = sseSubscribe(sid, { id: sid, write, close: () => controller.close() });

      // subscribe: dorm ถ้ามี
      let unsubDorm: (() => void) | null = null;
      if (dormId && dormId !== sid) {
        unsubDorm = sseSubscribe(dormId, { id: dormId, write, close: () => controller.close() });
      }

      // keep-alive
      const ping = setInterval(() => write(`event: ping\ndata: {}\n\n`), 25_000);

      (req as any).signal?.addEventListener?.('abort', () => {
        clearInterval(ping);
        try { unsubSession(); } catch {}
        try { unsubDorm?.(); } catch {}
        controller.close();
      });
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
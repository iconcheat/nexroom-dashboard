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

  if (!sid) {
    return new Response('missing session', { status: 401 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      write(`event: open\ndata: ${JSON.stringify({ ok: true })}\n\n`);

      // Replay ล่าสุด
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
          write(`data: ${JSON.stringify({ event: r.topic, data: r.payload })}\n\n`);
        }
      } catch (e) {
        console.error('[SSE] replay error', e);
      }

      // Subscribe ทั้ง session และ dorm
      const unsubscribeMain = sseSubscribe(sid, {
        id: sid,
        write,
        close: () => controller.close(),
      });

      let unsubscribeDorm: (() => void) | null = null;
      if (dormId && dormId !== sid) {
        unsubscribeDorm = sseSubscribe(dormId, {
          id: dormId,
          write,
          close: () => controller.close(),
        });
      }

      const ping = setInterval(() => write(`event: ping\ndata: {}\n\n`), 25_000);

      (req as any).signal?.addEventListener?.('abort', () => {
        clearInterval(ping);
        try { unsubscribeMain(); } catch {}
        try { unsubscribeDorm?.(); } catch {}
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
// src/app/api/ai/events/route.ts
import { NextRequest } from 'next/server';
import { sseSubscribe, extractSessionId } from '@/lib/bus';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const sid = extractSessionId(req);
  if (!sid) {
    return new Response('missing session', { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // helper เขียน sse chunk
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      // headers เปิดแล้ว
      write(`event: open\ndata: ${JSON.stringify({ ok: true })}\n\n`);

      // สมัครเข้า channel
      const unsubscribe = sseSubscribe(sid, {
        id: sid,
        write,
        close: () => controller.close(),
      });

      // keep-alive ทุก 25s (กัน proxy ปิด)
      const ping = setInterval(() => write(`event: ping\ndata: {}\n\n`), 25_000);

      // ปิดเมื่อ client หลุด
      (req as any).signal?.addEventListener?.('abort', () => {
        clearInterval(ping);
        unsubscribe();
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
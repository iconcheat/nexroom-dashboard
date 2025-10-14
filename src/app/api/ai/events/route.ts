// src/app/api/ai/events/route.ts
import { NextRequest } from 'next/server';
import { sseSubscribe, extractSessionId } from '@/lib/bus';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // 1) รับจาก query ให้สิทธิ์สูงสุด (สำหรับ dev/test หรือกรณีเปิดจากลิงก์)
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('session_id');

  // 2) ไม่มีก็ลองจาก cookie/header
  const sid = fromQuery || extractSessionId(req);

  if (!sid) {
    return new Response('missing session', { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      // เปิดสตรีมพร้อม event ชื่อ open
      write(`event: open\ndata: ${JSON.stringify({ ok: true })}\n\n`);

      // สมัครเข้า channel
      const unsubscribe = sseSubscribe(sid, {
        id: sid,
        write,
        close: () => controller.close(),
      });

      // keep-alive ทุก 25s
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
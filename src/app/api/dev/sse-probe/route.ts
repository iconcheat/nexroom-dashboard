// Simple SSE probe: ส่ง event:open แล้ว ping ทุก 5 วินาที
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const write = (s: string) => controller.enqueue(enc.encode(s));

      // เปิดสตรีม
      write(`event: open\ndata: {"ok":true}\n\n`);

      // ยิง ping เรื่อยๆ
      const timer = setInterval(() => {
        write(`event: ping\ndata: {}\n\n`);
      }, 5000);

      // ปิดเมื่อหลุด
      // @ts-ignore (NextRequest in edge บางทีไม่มี signal)
      _req?.signal?.addEventListener?.('abort', () => {
        clearInterval(timer);
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
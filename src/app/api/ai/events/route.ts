// src/app/api/ai/events/route.ts
import { NextRequest } from 'next/server';
import { sseSubscribe, extractSessionId } from '@/lib/bus';
import { getPool } from '@/lib/db';                 // new

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // รับจาก query ให้สิทธิ์สูงสุด (dev/test หรือเปิดจากลิงก์)
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('session_id');

  // ไม่มีก็ลองจาก cookie/header
  const sid = fromQuery || extractSessionId(req);

  if (!sid) {
    return new Response('missing session', { status: 401 });
  }

  const stream = new ReadableStream({
    async start(controller) {                       // แก้ไข: async เพื่อรอ replay
      const encoder = new TextEncoder();
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      // เปิดสตรีมพร้อม event ชื่อ open
      write(`event: open\ndata: ${JSON.stringify({ ok: true })}\n\n`);

      // ===== รีเพลย์ “เหตุการณ์ล่าสุด” จาก DB =====
      try {
        const pool = getPool();
        const rs = await pool.query(
          `select topic, payload
             from app.sse_events
            where session_id = $1
            order by created_at desc
            limit 20`,
          [sid]
        );
        for (const r of rs.rows) {
          write(`data: ${JSON.stringify({ event: r.topic, data: r.payload })}\n\n`);
        }
      } catch (e) {
        console.error('[SSE] replay error', e);
      }

      // สมัครเข้า channel (รับอีเวนต์สด)
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
// src/app/api/ai/events/route.ts
import { NextRequest } from 'next/server';
import { sseSubscribe, extractSessionId } from '@/lib/bus';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('session_id');
  const dormId = url.searchParams.get('dorm_id') || ''; // new
  const sid = fromQuery || extractSessionId(req);       // แก้ไข: ยืดหยุ่น cookie/header/query

  if (!sid) {
    return new Response('missing session', { status: 401 });
  }

  const stream = new ReadableStream({
    async start(controller) { // แก้ไข: async เพื่อรอ replay
      const encoder = new TextEncoder();
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      // เปิดสตรีม
      write(`event: open\ndata: ${JSON.stringify({ ok: true })}\n\n`);

      // ===== รีเพลย์จาก DB (ของเดิมคงไว้) =====
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
          // new: ช่วย debug เวลาเทสต์
          try { console.log('[SSE:replay]', sid, r.topic); } catch {}
          write(`data: ${JSON.stringify({ event: r.topic, data: r.payload })}\n\n`);
        }
      } catch (e) {
        console.error('[SSE] replay error', e);
      }

      // ===== ฟังสด: ตาม session เสมอ =====
      const unsubscribeMain = sseSubscribe(sid, {
        id: sid,
        write,
        close: () => controller.close(),
      });

      // ===== ฟังสด: ตาม dorm ถ้าส่งมา =====
      let unsubscribeDorm: (() => void) | null = null; // new
      if (dormId && dormId !== sid) {
        unsubscribeDorm = sseSubscribe(dormId, { // new
          id: dormId,
          write,
          close: () => controller.close(),
        });
      }

      // keep-alive
      const ping = setInterval(() => write(`event: ping\ndata: {}\n\n`), 25_000);

      // ปิดเมื่อ client หลุด
      (req as any).signal?.addEventListener?.('abort', () => {
        clearInterval(ping);
        try { unsubscribeMain(); } catch {}
        try { unsubscribeDorm?.(); } catch {} // new
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
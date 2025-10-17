// src/app/api/ai/events/route.ts
import { NextRequest } from 'next/server';
import { sseSubscribe, extractSessionId } from '@/lib/bus';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('session_id');
  const dormId = url.searchParams.get('dorm_id');          // new: รองรับ subscribe ตามหอพัก (multi-tenant)
  const sid = fromQuery || extractSessionId(req);           // แก้ไข: คงพฤติกรรมเดิม + รับจาก query

  if (!sid) {
    return new Response('missing session', { status: 401 });
  }

  // ====== START SSE STREAM ======
  const stream = new ReadableStream({
    async start(controller) {                                // แก้ไข: async เพื่อรองรับ replay DB
      const encoder = new TextEncoder();
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      // ----- เปิด stream -----
      write(`event: open\ndata: ${JSON.stringify({ ok: true })}\n\n`);

      // ----- รีเพลย์เหตุการณ์ล่าสุดจาก DB (คงของเดิม) -----
      try {
        const pool = getPool();
        const rs = await pool.query(
          `select topic, payload
             from app.sse_events
            where session_id = $1
            order by created_at desc
            limit 20`,
          [sid],
        );
        for (const r of rs.rows) {
          // new: log เล็กน้อยเวลาทดสอบ
          console.log('[SSE:replay]', sid, r.topic);
          write(`data: ${JSON.stringify({ event: r.topic, data: r.payload })}\n\n`);
        }
      } catch (e) {
        console.error('[SSE] replay error', e);
      }

      // ----- สมัครรับอีเวนต์สดตาม session (ของเดิม) -----
      let unsubscribe: () => void = sseSubscribe(sid, {     // แก้ไข: ใช้ let เพื่อให้ต่อยอดรวม unsubscribe ได้
        id: sid,
        write,
        close: () => controller.close(),
      });

      // ----- (ตัวเลือก) สมัครรับอีเวนต์ตาม dorm_id เพิ่มเติม -----
      if (dormId && dormId !== sid) {                       // new
        const unsubscribeDorm = sseSubscribe(dormId, {      // new
          id: dormId,
          write,
          close: () => controller.close(),
        });
        const oldUnsub = unsubscribe;                       // new
        unsubscribe = () => {                               // new: รวมเป็นตัวเดียว เรียกปิดทั้งสอง
          try { oldUnsub(); } catch {}
          try { unsubscribeDorm(); } catch {}
        };
      }

      // ----- keep-alive -----
      const ping = setInterval(() => write(`event: ping\ndata: {}\n\n`), 25_000);

      // ----- ปิดเมื่อ client หลุด -----
      (req as any).signal?.addEventListener?.('abort', () => {
        clearInterval(ping);
        try { unsubscribe(); } catch {}                     // แก้ไข: เรียกตัวรวม (session + dorm ถ้ามี)
        controller.close();
      });
    },
  });

  // ====== RETURN STREAM ======
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'connection': 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
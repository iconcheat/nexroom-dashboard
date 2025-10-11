import { NextRequest } from 'next/server';
import crypto from 'crypto';

// ===== In-memory registry สำหรับ broadcast SSE =====
type Client = { id: string; dormId: string; res: WritableStreamDefaultWriter };
const clientsRegistry = new Map<string, Client>();

function sendSSE(writer: WritableStreamDefaultWriter, data: any) {
  writer.write(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
}

// ให้ route อื่นเรียกได้ (ตอนนี้เราไม่ต้อง import จาก callback แล้ว)
(globalThis as any).broadcastSSE = (dormId: string, payload: any) => {
  for (const [id, c] of clientsRegistry.entries()) {
    if (c.dormId === dormId) sendSSE(c.res, payload);
  }
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dormId = searchParams.get('dorm_id') || 'unknown';
  const id = crypto.randomUUID();

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  clientsRegistry.set(id, { id, dormId, res: writer });

  // ส่ง hello ทันที
  sendSSE(writer, { event: 'connected', dorm_id: dormId });

  // keepalive
  const ping = setInterval(() => sendSSE(writer, { event: 'ping' }), 25000);

  const cleanup = () => {
    clearInterval(ping);
    clientsRegistry.delete(id);
  };

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
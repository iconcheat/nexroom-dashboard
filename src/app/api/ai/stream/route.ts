// /src/app/api/ai/stream/route.ts
import { NextRequest } from 'next/server';
import { clientsRegistry } from '../callback/route';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dormId = searchParams.get('dormId') || 'unknown';
  const id = crypto.randomUUID();

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  clientsRegistry.set(id, { id, dormId, res: writer });

  // ส่ง keepalive
  const ping = setInterval(() => {
    writer.write(`: ping ${Date.now()}\n\n`);
  }, 15000);

  const encoder = new TextEncoder();
  const send = (obj: any) =>
    writer.write(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

  // ส่ง hello ทันที
  await send({ type: 'hello', dormId });

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    }
  });
}
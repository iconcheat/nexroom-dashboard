// /src/app/api/ai/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const SHARED = process.env.N8N_SIGNING_SECRET!;

// ใช้ in-memory broadcaster ง่ายๆ (หรือย้ายไป Redis Pub/Sub ก็ได้)
type Client = { id: string; dormId: string; res: WritableStreamDefaultWriter };
const clients = new Map<string, Client>();

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get('x-nexroom-signature') || '';
  const calc = crypto.createHmac('sha256', SHARED).update(raw).digest('hex');
  if (sig !== calc) return NextResponse.json({ ok: false }, { status: 401 });

  const body = JSON.parse(raw);
  // body = { event:'reserve_summary'|'payment_done', dorm_id, booking_id, ... }

  // 2) persist สำรอง (ใช้ app.logs)
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO app.logs (flow, event, ref_id, actor, ok, detail)
       VALUES ($1,$2,$3,'n8n',true,$4::jsonb)`,
      ['reservation', body.event, body.booking_id || body.job_id || '', JSON.stringify(body)]
    );
  } finally {
    client.release();
  }

  // 3) broadcast ให้ผู้ที่ subscribe dorm_id นี้อยู่
  const payload = JSON.stringify({ type: 'event', data: body, ts: Date.now() });
  for (const c of clients.values()) {
    if (c.dormId === body.dorm_id) {
      try { await c.res.write(`${payload}\n`); } catch {}
    }
  }
  return NextResponse.json({ ok: true });
}

// สำหรับให้ SSE ลงทะเบียน client
export const clientsRegistry = clients;
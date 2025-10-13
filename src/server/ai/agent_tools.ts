// src/server/ai/agent_tools.ts
import { Pool } from 'pg';

let _pool: Pool | null = null;
export function getPool(): Pool {
  if (_pool) return _pool;
  const cs = process.env.DATABASE_URL;
  if (!cs) throw new Error('missing env: DATABASE_URL');
  _pool = new Pool({ connectionString: cs });
  return _pool;
}

/** งานหลักที่ n8n จะสวิตช์ต่อให้ */
export type RunKind = 'booking' | 'payment' | 'invoice' | 'checkin';

export type RunResult = {
  ok: boolean;
  kind: RunKind;
  id: string;
  hint?: string;
};

export async function runWorkflow(name: string, args: any): Promise<RunResult> {
  const n8n = process.env.N8N_URL;
  if (!n8n) throw new Error('missing env: N8N_URL');

  const r = await fetch(`${n8n}/webhook/agent.run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args }),
  });
  if (!r.ok) throw new Error(`n8n error ${r.status}`);

  const data = await r.json();
  // การันตี schema
  if (!data?.kind || !data?.id) {
    throw new Error('invalid run result: missing kind/id');
  }
  return {
    ok: true,
    kind: data.kind as RunKind,
    id: String(data.id),
    hint: data.hint ?? undefined,
  };
}

export type StatusResult =
  | {
      done: true;
      intent:
        | 'booking.completed'
        | 'payment.confirmed'
        | 'checkin.confirm'
        | 'invoice.generated';
      result: Record<string, any>;
    }
  | { done: false };

export async function getStatus(kind: RunKind, id: string): Promise<StatusResult> {
  const pool = getPool();

  if (kind === 'booking') {
    const { rows } = await pool.query(
      `select status, room, amount_due from app.bookings where booking_id=$1`,
      [id],
    );
    const b = rows?.[0];
    return b?.status === 'reserved'
      ? {
          done: true,
          intent: 'booking.completed',
          result: { booking_id: id, room: b?.room, amount_due: b?.amount_due },
        }
      : { done: false };
  }

  if (kind === 'payment') {
    const { rows } = await pool.query(
      `select status, amount, booking_id from app.payments where payment_id=$1`,
      [id],
    );
    const p = rows?.[0];
    return p?.status === 'confirmed'
      ? {
          done: true,
          intent: 'payment.confirmed',
          result: { payment_id: id, amount: p?.amount, booking_id: p?.booking_id },
        }
      : { done: false };
  }

  if (kind === 'checkin') {
    const { rows } = await pool.query(
      `select status, room_id, tenant_id from app.checkins where checkin_id=$1`,
      [id],
    );
    const c = rows?.[0];
    return c?.status === 'confirmed'
      ? {
          done: true,
          intent: 'checkin.confirm',
          result: { checkin_id: id, room_id: c?.room_id, tenant_id: c?.tenant_id },
        }
      : { done: false };
  }

  if (kind === 'invoice') {
    const { rows } = await pool.query(
      `select status, period, amount from app.invoices where invoice_id=$1`,
      [id],
    );
    const iv = rows?.[0];
    return iv && (iv.status === 'generated' || iv.status === 'sent')
      ? {
          done: true,
          intent: 'invoice.generated',
          result: { invoice_id: id, period: iv?.period, amount: iv?.amount },
        }
      : { done: false };
  }

  return { done: false };
}

export async function notifyTelegram(chatId: string, message: string) {
  const n8n = process.env.N8N_URL;
  if (!n8n) return { ok: false };

  try {
    const r = await fetch(`${n8n}/webhook/agent.notify_telegram`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message }),
    });
    return r.ok ? r.json() : { ok: false };
  } catch {
    return { ok: false };
  }
}
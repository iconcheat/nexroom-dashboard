import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function runWorkflow(name: string, args: any) {
  // เรียก n8n endpoint เดียวให้ switch ต่อในฝั่ง n8n
  const r = await fetch(`${process.env.N8N_URL}/webhook/agent.run`, {
    method:'POST', headers:{ 'content-type':'application/json' },
    body: JSON.stringify({ name, args })
  });
  if (!r.ok) throw new Error(`n8n error ${r.status}`);
  // ควรตอบ: { kind:'booking'|'payment'|'invoice'|'checkin', id:'...', hint?:'...' }
  return r.json();
}

export async function getStatus(kind: string, id: string) {
  if (kind === 'booking') {
    const { rows } = await pool.query(
      `select status, room, amount_due from app.bookings where booking_id=$1`, [id]
    );
    const b = rows[0];
    return {
      done: b?.status === 'reserved',
      intent: 'booking.completed',
      result: { booking_id:id, room:b?.room, amount_due:b?.amount_due }
    };
  }
  if (kind === 'payment') {
    const { rows } = await pool.query(
      `select status, amount from app.payments where payment_id=$1`, [id]
    );
    const p = rows[0];
    return {
      done: p?.status === 'confirmed',
      intent: 'payment.confirmed',
      result: { payment_id:id, amount:p?.amount }
    };
  }
  if (kind === 'checkin') {
    const { rows } = await pool.query(
      `select status, room_id, tenant_id from app.checkins where checkin_id=$1`, [id]
    );
    const c = rows[0];
    return {
      done: c?.status === 'confirmed',
      intent: 'checkin.confirm',
      result: { checkin_id:id, room_id:c?.room_id, tenant_id:c?.tenant_id }
    };
  }
  if (kind === 'invoice') {
    const { rows } = await pool.query(
      `select status, period, amount from app.invoices where invoice_id=$1`, [id]
    );
    const iv = rows[0];
    return {
      done: iv?.status === 'generated' || iv?.status === 'sent',
      intent: 'invoice.generated',
      result: { invoice_id:id, period:iv?.period, amount:iv?.amount }
    };
  }
  return { done:false };
}

export async function notifyTelegram(chatId: string, message: string) {
  // ทางเลือก: ให้ n8n เป็นคนส่ง (แนะนำ) → จะสเกลง่ายกว่า
  return fetch(`${process.env.N8N_URL}/webhook/agent.notify_telegram`, {
    method:'POST', headers:{ 'content-type':'application/json' },
    body: JSON.stringify({ chat_id: chatId, message })
  }).then(r=>r.json()).catch(()=>({ok:false}));
}
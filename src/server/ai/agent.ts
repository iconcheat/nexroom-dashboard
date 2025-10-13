// src/server/ai/agent.ts
import { runWorkflow, getStatus, notifyTelegram, RunKind, RunResult } from './agent_tools';
import { GeminiLite } from './llm';

const llm = new GeminiLite();

type ActionBtn =
  | { type: 'postback'; label: string; action: string; args?: any }
  | { type: 'open_url'; label: string; url: string };

type HandleInput = {
  text?: string;
  action?: string;
  args?: any;
  trace_id?: string;
  dorm_id?: string;
};

// กลุ่ม intent ที่ถือว่าเป็น "คำสั่งให้ทำงานจริง" (ให้ยิงเข้า worker)
const WORKFLOW_ACTIONS = new Set<string>([
  // booking flow
  'booking.create',
  // payment
  'payment.cash',
  'payment.bank',
  // checkin
  'checkin.schedule',
  'checkin.prepare',
  'checkin.confirm',
  // invoice
  'invoice.generate',
  'invoice.generate_initial',
  'invoice.send_batch',
  // misc
  'receipt.issue',
  'contract.issue',
  'meter.baseline',
  'notify.welcome',
  'notify.movein_reminder',
  'reminder.setup_due',
]);

export async function agentHandle(input: HandleInput) {
  const { text, action, args, trace_id, dorm_id } = input || {};

  // A) กรณีผู้ใช้ "กดปุ่ม" → ยิงเข้า n8n แล้วโพลสถานะ
  if (action) {
    const run = (await runWorkflow(action, { ...args, trace_id, dorm_id })) as RunResult;

    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const st = await getStatus(run.kind, run.id);
      if (st.done) return proposeNext(st.intent, st.result);
    }
    return { message: '⚙️ กำลังประมวลผล… จะอัปเดตให้อัตโนมัติ', actions: [] as ActionBtn[] };
  }

  // B) ผู้ใช้ "พิมพ์ข้อความ"
  const raw = String(text || '').trim();
  if (!raw) return { message: 'ต้องการให้ช่วยอะไรครับ?', actions: [] as ActionBtn[] };

  // ให้ LLM ตีเจตนา
  const intent = await llm.detectIntent(raw);

  // ถ้า LLM จัดเป็น workflow → ยิงเข้าทำงานเหมือนกดปุ่ม
  if (WORKFLOW_ACTIONS.has(intent)) {
    const run = (await runWorkflow(intent, { ...args, trace_id, dorm_id })) as RunResult;

    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const st = await getStatus(run.kind, run.id);
      if (st.done) return proposeNext(st.intent, st.result);
    }
    return { message: '⚙️ รับคำสั่งแล้ว กำลังดำเนินการให้ครับ…', actions: [] as ActionBtn[] };
  }

  // ไม่ใช่ workflow → ตอบเชิงสนทนา + แนะนำปุ่ม
  const reply = await llm.proposeMessage({ user: raw });
  return {
    message: reply.message,
    actions: [
      { type: 'postback', label: 'เปิดระบบจอง', action: 'booking.create', args: {} },
      { type: 'postback', label: 'ออกบิลเดือนนี้', action: 'invoice.generate', args: {} },
    ],
  };
}

/** แปลง intent ปลายทาง → ข้อความ + ปุ่มงานถัดไป (ศูนย์กลางเวิร์กโฟลว์) */
function proposeNext(intent: string, result: any) {
  if (intent === 'booking.completed') {
    const amt = Number(result?.amount_due || 0).toLocaleString();
    const bookingId = result?.booking_id || '';
    return {
      message: `✅ จองสำเร็จ ยอดชำระ ${amt} บาท ต้องการดำเนินการต่อไหม?`,
      actions: [
        { type: 'postback', label: 'ชำระเงินสด', action: 'payment.cash', args: { booking_id: bookingId } },
        { type: 'postback', label: 'ชำระแบบโอน', action: 'payment.bank', args: { booking_id: bookingId } },
        { type: 'postback', label: 'ตั้งวันย้ายเข้า', action: 'checkin.schedule', args: { booking_id: bookingId } },
        { type: 'postback', label: 'ไว้ก่อน', action: 'noop', args: {} },
      ] as ActionBtn[],
    };
  }

  if (intent === 'payment.confirmed') {
    const paymentId = result?.payment_id || '';
    const bookingId = result?.booking_id || '';
    return {
      message: `✅ รับเงินเรียบร้อย ต้องการออกเอกสารต่อไหม?`,
      actions: [
        { type: 'postback', label: 'ออกใบเสร็จ', action: 'receipt.issue', args: { payment_id: paymentId } },
        { type: 'postback', label: 'ออกสัญญาเช่า', action: 'contract.issue', args: { booking_id: bookingId } },
        { type: 'postback', label: 'เตรียมเช็คอิน', action: 'checkin.prepare', args: { booking_id: bookingId } },
      ] as ActionBtn[],
    };
  }

  if (intent === 'checkin.confirm') {
    const roomId = result?.room_id || '';
    return {
      message: `🧳 เช็คอินสำเร็จ ห้อง ${roomId}\nต้องการดำเนินการต่อไหม?`,
      actions: [
        { type: 'postback', label: 'บันทึกมิเตอร์ตั้งต้น', action: 'meter.baseline', args: { room_id: roomId } },
        { type: 'postback', label: 'ออกบิลแรก', action: 'invoice.generate_initial', args: { room_id: roomId } },
        { type: 'postback', label: 'ส่งคู่มือเข้าพัก', action: 'notify.welcome', args: { room_id: roomId } },
      ] as ActionBtn[],
    };
  }

  if (intent === 'invoice.generated') {
    const invoiceId = result?.invoice_id || '';
    return {
      message: `🧾 ออกบิลเรียบร้อย ต้องการส่งบิลให้ผู้เช่าหรือไม่ครับ?`,
      actions: [
        { type: 'postback', label: 'ส่งบิลทั้งหมด', action: 'invoice.send_batch', args: { invoice_id: invoiceId } },
        { type: 'postback', label: 'ตั้งแจ้งเตือนค้างจ่าย', action: 'reminder.setup_due', args: { invoice_id: invoiceId } },
      ] as ActionBtn[],
    };
  }

  return { message: 'ต้องการให้ช่วยอะไรต่อครับ?', actions: [] as ActionBtn[] };
}
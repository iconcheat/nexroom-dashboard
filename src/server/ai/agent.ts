import { GeminiLite } from './llm';
import { runWorkflow, getStatus, notifyTelegram } from './agent_tools';

const llm = new GeminiLite();

type ActionBtn = { type:'postback'|'open_url', label:string, action?:string, args?:any, url?:string };

export async function agentHandle(input: any) {
  const { text, action, args, trace_id, dorm_id } = input || {};

  // A) ผู้ใช้กดปุ่ม → สั่งงาน แล้วเฝ้าดูจนเสร็จ (โพล 3–6 ครั้งพอ)
  if (action) {
    const run = await runWorkflow(action, { ...args, trace_id, dorm_id });

    for (let i=0; i<6; i++) {
      await new Promise(r => setTimeout(r, 1500));
      const st = await getStatus(run.kind, run.id);
      if (st.done) return proposeNext(st.intent, st.result);
    }
    return { message:'⚙️ กำลังประมวลผล… จะอัปเดตให้อัตโนมัติ', actions:[] as ActionBtn[] };
  }

  // B) ผู้ใช้พิมพ์ข้อความ → ตรวจ intent แล้วเสนอขั้นตอน
  const intent = await llm.detectIntent(String(text||''));
  return proposeNext(intent, {});
}

function proposeNext(intent: string, result: any) {
  if (intent === 'booking.completed') {
    const amt = Number(result?.amount_due||0).toLocaleString();
    const bookingId = result?.booking_id || '';
    return {
      message: `✅ จองสำเร็จ ยอดชำระ ${amt} บาท ต้องการดำเนินการต่อไหม?`,
      actions: [
        { type:'postback', label:'ชำระเงินสด', action:'payment.cash', args:{ booking_id: bookingId } },
        { type:'postback', label:'ชำระแบบโอน', action:'payment.bank', args:{ booking_id: bookingId } },
        { type:'postback', label:'ตั้งวันย้ายเข้า', action:'checkin.schedule', args:{ booking_id: bookingId } },
        { type:'postback', label:'ไว้ก่อน', action:'noop' }
      ] as ActionBtn[]
    };
  }

  if (intent === 'payment.confirmed') {
    const paymentId = result?.payment_id || '';
    const bookingId = result?.booking_id || '';
    return {
      message: `✅ รับเงินเรียบร้อย ต้องการออกเอกสารต่อไหม?`,
      actions: [
        { type:'postback', label:'ออกใบเสร็จ', action:'receipt.issue', args:{ payment_id: paymentId } },
        { type:'postback', label:'ออกสัญญาเช่า', action:'contract.issue', args:{ booking_id: bookingId } },
        { type:'postback', label:'เตรียมเช็คอิน', action:'checkin.prepare', args:{ booking_id: bookingId } },
      ] as ActionBtn[]
    };
  }

  if (intent === 'checkin.confirm') {
    const roomId = result?.room_id || '';
    return {
      message: `🧳 เช็คอินสำเร็จ ห้อง ${roomId}\nต้องการดำเนินการต่อไหม?`,
      actions: [
        { type:'postback', label:'บันทึกมิเตอร์ตั้งต้น', action:'meter.baseline', args:{ room_id: roomId } },
        { type:'postback', label:'ออกบิลแรก', action:'invoice.generate_initial', args:{ room_id: roomId } },
        { type:'postback', label:'ส่งคู่มือเข้าพัก', action:'notify.welcome', args:{ room_id: roomId } },
      ] as ActionBtn[]
    };
  }

  if (intent === 'invoice.generated') {
    const invoiceId = result?.invoice_id || '';
    return {
      message: `🧾 ออกบิลเรียบร้อย ต้องการส่งบิลให้ผู้เช่าหรือไม่ครับ?`,
      actions: [
        { type:'postback', label:'ส่งบิลทั้งหมด', action:'invoice.send_batch', args:{ invoice_id: invoiceId } },
        { type:'postback', label:'ตั้งแจ้งเตือนค้างจ่าย', action:'reminder.setup_due', args:{ invoice_id: invoiceId } },
      ] as ActionBtn[]
    };
  }

  return { message:'ต้องการให้ช่วยอะไรต่อครับ?', actions:[] as ActionBtn[] };
}
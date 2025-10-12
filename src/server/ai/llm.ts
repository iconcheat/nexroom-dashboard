import fs from 'node:fs';
import path from 'node:path';

type ProposeInput = { user: string, context?: any };

export class GeminiLite {
  private system: string;
  constructor() {
    const p = path.join(process.cwd(), 'src/prompts/system-nexroom-jarvis.md');
    this.system = fs.readFileSync(p, 'utf8');
  }

  async detectIntent(text: string): Promise<string> {
    // TODO: เรียก Gemini จริง; ชั่วคราวใส่ rule เบาๆ กันพลาด
    const t = text.toLowerCase();
    if (t.includes('จอง') || t.includes('ห้อง')) return 'booking.create';
    if (t.includes('มัดจำ') || t.includes('รับเงิน')) return 'payment.cash';
    if (t.includes('เช็คอิน') || t.includes('ย้ายเข้า')) return 'checkin.confirm';
    if (t.includes('บิล') || t.includes('อินวอย')) return 'invoice.generate';
    if (t.includes('ย้ายออก') || t.includes('เช็คเอาต์')) return 'moveout.request';
    return 'general.help';
  }

  async proposeMessage(input: ProposeInput): Promise<{message:string}> {
    // ปกติจะ call LLM เพื่อสรุปข้อความสวยๆ; เริ่มต้นทำแบบคงที่ก่อน
    const txt = String(input.user || '').trim();
    return { message: txt ? `รับทราบครับ: ${txt}` : 'ต้องการให้ช่วยอะไรครับ?' };
  }
}
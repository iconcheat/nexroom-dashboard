'use client';
import { useRef, useState } from 'react';

export type AgentAction =
  | { type: 'postback'; label: string; action: string; args?: any }
  | { type: 'open_url'; label: string; url: string };

export type AgentMessage = {
  from: 'user' | 'agent' | 'system';
  text: string;
  actions?: AgentAction[];
};

type SendPayload = {
  message: string;
  context: {
    staff_id: string;
    full_name?: string | null;
    role?: string;
    dorm_id: string;         // ❗ ต้องมี
    dormName?: string;
    session_id?: string;
    channel?: 'dashboard';
    locale?: 'th-TH' | string;
  };
};

export function useAgent() {
  const [logs, setLogs] = useState<AgentMessage[]>([]);
  const sendingRef = useRef(false);

  const push = (m: AgentMessage) =>
    setLogs((prev) => [...prev, m]);

  async function sendText(text: string) {
    if (sendingRef.current) return;
    sendingRef.current = true;

    // 1) แสดงข้อความ user ก่อน
    push({ from: 'user', text });

    // 2) เตรียม payload (ใส่ context ให้ครบ)
    const payload: SendPayload = {
      message: text,
      context: {
        staff_id: 'manager-01',              // ใส่จริงจาก session/login
        full_name: 'Manager',
        role: 'viewer',
        dorm_id: '6994dfab-98c5-4f12-bf3c-b1e371716c3c', // ❗ ห้ามว่าง
        dormName: 'พีดี เพลส',
        session_id: 'sess-' + Math.random().toString(36).slice(2),
        channel: 'dashboard',
        locale: 'th-TH',
      },
    };

    try {
      // 3) ส่งให้ API ภายในของเรา
      const r = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => ({}));

      // n8n ฝั่งคุณตอบกลับได้ 2 แบบที่พบบ่อย:
      // - { reply: 'ข้อความ...', actions: [...] }
      // - { message: 'ข้อความ...', actions: [...] }
      const replyText = data.reply || data.message || '…';
      const actions: AgentAction[] = Array.isArray(data.actions) ? data.actions : [];

      push({ from: 'agent', text: String(replyText || ''), actions });
    } catch (err: any) {
      push({ from: 'system', text: `❌ ส่งไม่สำเร็จ: ${err?.message || 'unknown error'}` });
    } finally {
      sendingRef.current = false;
    }
  }

  // เมื่อผู้ใช้ “กดปุ่ม” ที่ agent ส่งมา (postback/open_url)
  async function clickAction(btn: AgentAction) {
    if (btn.type === 'open_url' && btn.url) {
      window.open(btn.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (btn.type === 'postback') {
      // แสดงว่าเรากดอะไร
      push({ from: 'user', text: `▶ ${btn.label}` });

      // ส่งคำสั่งลัดนี้กลับไปหา agent ผ่าน webhook ตัวเดิม
      const payload = {
        action: btn.action,
        args: btn.args || {},
        // ใส่ context สั้น ๆ ให้ครบ
        context: {
          staff_id: 'manager-01',
          dorm_id: '6994dfab-98c5-4f12-bf3c-b1e371716c3c', // ❗ ห้ามว่าง
          dormName: 'พีดี เพลส',
          channel: 'dashboard',
          locale: 'th-TH',
        },
      };

      try {
        const r = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await r.json().catch(() => ({}));
        const replyText = data.reply || data.message || '…';
        const actions: AgentAction[] = Array.isArray(data.actions) ? data.actions : [];
        push({ from: 'agent', text: String(replyText || ''), actions });
      } catch (err: any) {
        push({ from: 'system', text: `❌ คำสั่งล้มเหลว: ${err?.message || 'unknown error'}` });
      }
    }
  }

  return { logs, sendText, clickAction };
}
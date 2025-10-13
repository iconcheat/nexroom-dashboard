'use client';
import { useEffect, useRef, useState } from 'react';

type ActionBtn = { type:'postback'|'open_url', label:string, action?:string, args?:any, url?:string };
type LogMsg = { from:'user'|'agent', text:string, actions?:ActionBtn[] };

type Session = {
  staff_id: string;
  username?: string;
  full_name?: string;
  role?: string;
  dorm_id?: string;
  dorm_name?: string;
  session_id?: string;
  telegram_id?: string;
};

export function useAgent() {
  const [logs, setLogs] = useState<LogMsg[]>([]);
  const sessionRef = useRef<Session | null>(null);

  // 1) โหลด session จริงหลัง login
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/session', { cache: 'no-store' });
        if (r.ok) {
          const s = await r.json();
          sessionRef.current = {
            staff_id: s.staff_id,
            username: s.username,
            full_name: s.full_name,
            role: s.role,
            dorm_id: s.dorm_id,
            dorm_name: s.dorm_name,
            session_id: s.session_id,
            telegram_id: s.telegram_id,
          };
        } else {
          sessionRef.current = null; // บังคับให้เห็น error ง่าย ๆ ถ้าไม่มี session
        }
      } catch {
        sessionRef.current = null;
      }
    })();
  }, []);

  // util
  const push = (m: LogMsg) => setLogs(prev => [...prev, m]);

  // 2) ส่งข้อความไป n8n ผ่าน NEXT api
  const sendText = async (text: string) => {
    push({ from: 'user', text });

    const sess = sessionRef.current;
    if (!sess?.staff_id) {
      push({ from: 'agent', text: '❗ ยังไม่มี session (staff_id) — กรุณาเข้าสู่ระบบใหม่' });
      return;
    }

    const body = {
      message: text,
      context: {
        dorm_id:   sess.dorm_id,
        dorm_name: sess.dorm_name,
        staff_id:  sess.staff_id,
        username:  sess.username,
        full_name: sess.full_name,
        role:      sess.role,
        session_id:sess.session_id,
        telegram_id:sess.telegram_id,
        channel:   'dashboard',
        locale:    'th-TH',
      },
    };

    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      push({ from: 'agent', text: `❌ ส่งไม่สำเร็จ (${res.status})` });
      return;
    }

    const data = await res.json();
    push({ from: 'agent', text: data.reply || data.message || 'โอเค', actions: data.actions || [] });
  };

  const clickAction = async (btn: ActionBtn) => {
    if (btn.type === 'open_url' && btn.url) {
      window.open(btn.url, '_blank');
      return;
    }
    // ส่งปุ่มเป็น postback กลับไป API เดิม
    const sess = sessionRef.current;
    if (!sess?.staff_id) {
      push({ from: 'agent', text: '❗ ยังไม่มี session — กรุณาเข้าสู่ระบบใหม่' });
      return;
    }

    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: btn.action,
        args: btn.args || {},
        context: {
          dorm_id:   sess.dorm_id,
          dorm_name: sess.dorm_name,
          staff_id:  sess.staff_id,
          username:  sess.username,
          full_name: sess.full_name,
          role:      sess.role,
          session_id:sess.session_id,
          channel:   'dashboard',
          locale:    'th-TH',
        },
      }),
    });
    const data = await res.json().catch(()=>({message:'เกิดข้อผิดพลาด'}));
    push({ from: 'agent', text: data.reply || data.message || 'โอเค', actions: data.actions || [] });
  };

  return { logs, sendText, clickAction };
}
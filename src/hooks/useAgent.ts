// src/hooks/useAgent.ts
'use client';
import { useEffect, useRef, useState } from 'react';

export type AgentAction =
  | { type: 'postback'; label: string; action: string; args?: any }
  | { type: 'open_url'; label: string; url: string };

export type ChatLog = { from: 'user'|'agent'; text: string; actions?: AgentAction[] };

type AgentContext = {
  staff_id: string;
  dorm_id: string;
  dorm_name?: string | null;
  role?: string | null;
  session_id?: string | null;
  locale?: string;
};

export function useAgent() {
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [sending, setSending] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // 👉 เก็บ context ที่ดึงมาจาก /api/session/me
  const ctxRef = useRef<AgentContext | null>(null);

  // 1) โหลด session/context ครั้งเดียว
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/session/me', { cache: 'no-store' });
        const data = await r.json();
        if (data?.ok) {
          ctxRef.current = {
            staff_id: String(data.staff_id),
            dorm_id: String(data.dorm_id),
            dorm_name: data.dorm_name ?? null,
            role: data.role ?? null,
            session_id: data.session_id ?? null,
            locale: 'th-TH',
          };
        } else {
          // กรณีไม่มี session แจ้งผู้ใช้ให้ออกจากระบบ/เข้าใหม่
          setLogs((prev) => [
            ...prev,
            { from: 'agent', text: 'ยังไม่มี session (staff_id) — กรุณาเข้าสู่ระบบใหม่' },
          ]);
        }
      } catch {
        setLogs((prev) => [
          ...prev,
          { from: 'agent', text: 'ดึงข้อมูลเซสชันไม่สำเร็จ' },
        ]);
      }
    })();
  }, []);

  // 2) subscribe SSE
  useEffect(() => {
    if (esRef.current) return;
    const es = new EventSource('/api/ai/events');
    es.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data || '{}');
        if (msg?.message) {
          setLogs((prev) => [...prev, { from:'agent', text:String(msg.message), actions:msg.actions || [] }]);
        }
      } catch {}
    });
    esRef.current = es;
    return () => { es.close(); esRef.current = null; };
  }, []);

  // 3) ส่งข้อความ → แนบ context ไปด้วย
  const sendText = async (text: string) => {
    setLogs((prev) => [...prev, { from:'user', text }]);
    setSending(true);
    try {
      const r = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type':'application/json' },
        body: JSON.stringify({
          message: text,
          context: ctxRef.current ?? undefined,   // <<<<<<<<<< สำคัญ
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (data?.message) {
        setLogs((prev) => [...prev, { from:'agent', text:String(data.message), actions:data.actions || [] }]);
      } else if (data?.error) {
        setLogs((prev) => [...prev, { from:'agent', text:`ผิดพลาด: ${data.error}` }]);
      }
    } finally {
      setSending(false);
    }
  };

  // 4) กดปุ่มแอคชัน → แนบ context ด้วยเหมือนกัน
  const clickAction = async (a: AgentAction) => {
    if (a.type === 'open_url') {
      window.open(a.url, '_blank', 'noopener,noreferrer');
      return;
    }
    setLogs((prev) => [...prev, { from:'user', text:`▶ ${a.label}` }]);
    setSending(true);
    try {
      const r = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type':'application/json' },
        body: JSON.stringify({
          action: a.action,
          args: a.args || {},
          context: ctxRef.current ?? undefined,   // <<<<<<<<<< สำคัญ
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (data?.message) {
        setLogs((prev) => [...prev, { from:'agent', text:String(data.message), actions:data.actions || [] }]);
      } else if (data?.error) {
        setLogs((prev) => [...prev, { from:'agent', text:`ผิดพลาด: ${data.error}` }]);
      }
    } finally {
      setSending(false);
    }
  };

  return { logs, sendText, clickAction, sending };
}
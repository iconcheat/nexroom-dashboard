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

const SESSION_WARN =
  'ยังไม่ได้เข้าสู่ระบบหรือเซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้งค่ะ';

export function useAgent() {
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false); // รู้ว่าโหลด /me เสร็จหรือยัง
  const esRef = useRef<EventSource | null>(null);
  const ctxRef = useRef<AgentContext | null>(null);

  // 1) โหลด session/context ครั้งเดียว (แจ้งเตือนเฉพาะ 401 เท่านั้น)
  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      try {
        const r = await fetch('/api/session/me', {
          cache: 'no-store',
          signal: ac.signal,
        });
        const data = await r.json().catch(() => ({}));

        if (r.ok && data?.ok) {
          ctxRef.current = {
            staff_id: String(data.staff_id),
            dorm_id: String(data.dorm_id),
            dorm_name: data.dorm_name ?? null,
            role: data.role ?? null,
            session_id: data.session_id ?? null,
            locale: 'th-TH',
          };
          // ล้างข้อความเตือนเก่าถ้ามี
          setLogs((prev) => prev.filter((m) => m.text !== SESSION_WARN));
        } else if (r.status === 401) {
          // เตือนแบบสุภาพ และกันไม่ให้ซ้ำ
          setLogs((prev) =>
            prev.some((m) => m.text === SESSION_WARN)
              ? prev
              : [...prev, { from: 'agent', text: SESSION_WARN }]
          );
        } // สถานะอื่น ๆ เงียบไว้ ไม่ต้องป่วนหน้าจอ
      } catch {
        // เครือข่ายหลุดก็เงียบไว้เช่นกัน
      } finally {
        setLoaded(true);
      }
    })();

    return () => ac.abort();
  }, []);

  // 2) subscribe SSE
  useEffect(() => {
    if (esRef.current) return;
    const es = new EventSource('/api/ai/events');
    es.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data || '{}');
        if (msg?.message) {
          setLogs((prev) => [
            ...prev,
            { from: 'agent', text: String(msg.message), actions: msg.actions || [] },
          ]);
        }
      } catch {
        /* ignore */
      }
    });
    esRef.current = es;
    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  // 3) ส่งข้อความ → แนบ context ไปด้วย (ถ้ายังโหลดไม่เสร็จ ก็ส่งไปก่อนแต่ยังแนบ context ไม่ได้)
  const sendText = async (text: string) => {
    setLogs((prev) => [...prev, { from: 'user', text }]);
    setSending(true);
    try {
      const r = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: ctxRef.current ?? undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (data?.message) {
        setLogs((prev) => [
          ...prev,
          { from: 'agent', text: String(data.message), actions: data.actions || [] },
        ]);
      } else if (data?.error) {
        setLogs((prev) => [...prev, { from: 'agent', text: `ผิดพลาด: ${data.error}` }]);
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
    setLogs((prev) => [...prev, { from: 'user', text: `▶ ${a.label}` }]);
    setSending(true);
    try {
      const r = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: a.action,
          args: a.args || {},
          context: ctxRef.current ?? undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (data?.message) {
        setLogs((prev) => [
          ...prev,
          { from: 'agent', text: String(data.message), actions: data.actions || [] },
        ]);
      } else if (data?.error) {
        setLogs((prev) => [...prev, { from: 'agent', text: `ผิดพลาด: ${data.error}` }]);
      }
    } finally {
      setSending(false);
    }
  };

  return { logs, sendText, clickAction, sending };
}
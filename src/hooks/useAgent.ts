// src/hooks/useAgent.ts
'use client';
import { useEffect, useRef, useState } from 'react';

export type AgentAction =
  | { type: 'postback'; label: string; action: string; args?: any }
  | { type: 'open_url'; label: string; url: string };

export type ChatLog = { from: 'user' | 'agent'; text: string; actions?: AgentAction[] };

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

  // สถานะการเตรียมเซสชัน
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const ctxRef = useRef<AgentContext | null>(null);
  const loadingSessionRef = useRef<Promise<void> | null>(null);

  // ----- โหลด session ครั้งแรก -----
  async function loadSessionOnce() {
    if (loadingSessionRef.current) return loadingSessionRef.current;

    loadingSessionRef.current = (async () => {
      setSessionError(null);
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
          setReady(true);
          // Optional: ส่งข้อความต้อนรับสั้นๆ เมื่อพร้อมใช้งาน
          setLogs((prev) => [
            ...prev,
            { from: 'agent', text: 'สวัสดีค่ะ ยินดีต้อนรับสู้ NEXRoom ค่ะ ยินดีให้บริการค่ะแล้ววันนี้ มีอะไรสามารถบอกฉันได้เลยค่ะ 😊' },
          ]);
        } else {
          setSessionError(data?.reason || 'no_session');
          setReady(false);
        }
      } catch (e) {
        setSessionError('fetch_failed');
        setReady(false);
      }
    })();

    return loadingSessionRef.current.finally(() => {
      loadingSessionRef.current = null;
    });
  }

  // เรียกทันทีตอน mount
  useEffect(() => {
    loadSessionOnce();
  }, []);

  // ----- SSE subscribe -----
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
        // ignore parse error
      }
    });
    esRef.current = es;
    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  // Helper: ให้ทุกการส่ง “รอเซสชัน” ก่อน
  async function ensureSession() {
    if (ready && ctxRef.current) return true;
    await loadSessionOnce();
    if (!ctxRef.current) {
      // แสดงข้อความเตือนครั้งเดียว ณ จุดที่จำเป็นเท่านั้น
      setLogs((prev) => [
        ...prev,
        { from: 'agent', text: 'ยังไม่มีเซสชัน — กรุณาเข้าสู่ระบบใหม่' },
      ]);
      return false;
    }
    return true;
  }

  // ----- ส่งข้อความ -----
  const sendText = async (text: string) => {
    setLogs((prev) => [...prev, { from: 'user', text }]);

    // กัน race: ต้องมีเซสชันก่อน
    const ok = await ensureSession();
    if (!ok) return;

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

  // ----- คลิกปุ่ม action -----
  const clickAction = async (a: AgentAction) => {
    if (a.type === 'open_url') {
      window.open(a.url, '_blank', 'noopener,noreferrer');
      return;
    }

    setLogs((prev) => [...prev, { from: 'user', text: `▶ ${a.label}` }]);

    const ok = await ensureSession();
    if (!ok) return;

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

  return { logs, sendText, clickAction, sending, ready, sessionError };
}
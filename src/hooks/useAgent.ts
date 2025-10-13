// src/hooks/useAgent.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** ปุ่ม/แอคชันที่เอเยนต์ส่งมาให้ UI แสดง */
export type AgentAction = {
  type: 'postback' | 'open_url';
  label: string;
  action?: string;
  args?: any;
  url?: string;
};

/** 1 แถวในหน้าจอสนทนา */
export type ChatRow = {
  from: 'user' | 'agent' | 'system';
  text: string;
  actions?: AgentAction[];
};

type AgentReply =
  | {
      ok: true;
      message?: string;
      reply?: string;
      actions?: AgentAction[];
      mode?: 'queued' | 'fast';
      lane?: string;
      job_id?: string;
      meta?: any;
    }
  | {
      ok: false;
      error?: string;
      message?: string;
    };

type SessionMe =
  | {
      ok: true;
      session_id: string;
      staff_id: string;
      username: string | null;
      full_name: string | null;
      role: string;
      dorm_id: string;
      dorm_name: string | null;
      telegram_id: string | null;
      expires_at?: string;
    }
  | { ok: false; [k: string]: any };

/** hook หลัก: ใช้ใน <AgentChat/> */
export function useAgent() {
  const [logs, setLogs] = useState<ChatRow[]>(() => {
    // พก state เบา ๆ ใน localStorage กันหน้ากระพริบ (ไม่จำเป็นต้องมีก็ได้)
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('nxr_agent_logs');
      return raw ? (JSON.parse(raw) as ChatRow[]) : [];
    } catch {
      return [];
    }
  });

  const sessionRef = useRef<SessionMe | null>(null);
  const loadingSession = useRef(false);

  // บันทึกลง localStorage ทุกครั้งที่มีการเปลี่ยนแปลง
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nxr_agent_logs', JSON.stringify(logs));
    }
  }, [logs]);

  /** โหลด session/me ครั้งแรก (ดึง staff_id, dorm_id, role ฯลฯ) */
  const ensureSession = useCallback(async () => {
    if (sessionRef.current || loadingSession.current) return sessionRef.current;
    loadingSession.current = true;
    try {
      const r = await fetch('/api/session/me', { cache: 'no-store' });
      const j: SessionMe = await r.json().catch(() => ({ ok: false }));
      sessionRef.current = j;
      if (!j.ok) {
        setLogs((prev) => [
          ...prev,
          {
            from: 'system',
            text: '❗ ยังไม่มี session (staff_id) — กรุณาเข้าสู่ระบบใหม่',
          },
        ]);
      }
      return j;
    } catch (e: any) {
      setLogs((prev) => [
        ...prev,
        {
          from: 'system',
          text: `❌ โหลดเซสชันไม่สำเร็จ: ${String(e?.message || e)}`,
        },
      ]);
      return null;
    } finally {
      loadingSession.current = false;
    }
  }, []);

  /** แปลงผลจาก /api/ai/chat ให้เป็น ChatRow */
  const pushAgentReply = useCallback((res: AgentReply) => {
    if (!res) return;
    if ('ok' in res && !res.ok) {
      setLogs((prev) => [
        ...prev,
        { from: 'agent', text: res.message || `❌ ${res.error || 'เกิดข้อผิดพลาด'}` },
      ]);
      return;
    }
    const msg =
      (res as any).message || (res as any).reply || 'ต้องการให้ช่วยอะไรต่อครับ?';
    const actions = (res as any).actions || [];
    setLogs((prev) => [...prev, { from: 'agent', text: msg, actions }]);
  }, []);

  /** ผู้ใช้พิมพ์ → ส่งข้อความไปเอเยนต์ */
  const sendText = useCallback(
    async (text: string) => {
      setLogs((prev) => [...prev, { from: 'user', text }]);

      const sess = await ensureSession();
      if (!sess || !('ok' in sess) || !sess.ok) return;

      // ตัว route /api/ai/chat จะอ่าน cookie เองอยู่แล้ว
      // ส่งเฉพาะ message; context เพิ่มเติมไม่ต้องย้ำ
      try {
        const r = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            message: text,
            context: {
              // ไม่จำเป็นต้องครบทุกฟิลด์ เพราะฝั่ง API จะอ่านจาก cookie/header ซ้ำ
              staff_id: sess.staff_id,
              dorm_id: sess.dorm_id,
              role: sess.role,
              dorm_name: sess.dorm_name,
              session_id: sess.session_id,
            },
          }),
        });
        const j: AgentReply = await r.json().catch(() => ({
          ok: false,
          error: 'bad_json',
        }));
        pushAgentReply(j);
      } catch (e: any) {
        setLogs((prev) => [
          ...prev,
          { from: 'agent', text: `❌ ส่งข้อความไม่สำเร็จ: ${String(e?.message || e)}` },
        ]);
      }
    },
    [ensureSession, pushAgentReply],
  );

  /** ผู้ใช้กดปุ่มแอคชันจากเอเยนต์ */
  const clickAction = useCallback(
    async (btn: AgentAction) => {
      // แสดงในแชทก่อนว่าผู้ใช้กดอะไร
      setLogs((prev) => [...prev, { from: 'user', text: `• ${btn.label}` }]);

      if (btn.type === 'open_url' && btn.url) {
        // เปิดแท็บใหม่ + แจ้งในห้องแชท
        try {
          window.open(btn.url, '_blank', 'noopener,noreferrer');
        } catch {}
        setLogs((prev) => [
          ...prev,
          { from: 'agent', text: '⚙️ เปิดหน้าทำงานให้แล้วในแท็บใหม่' },
        ]);
        return;
      }

      // postback → ให้ /api/ai/chat เป็น gateway ไป n8n
      if (btn.type === 'postback' && btn.action) {
        const sess = await ensureSession();
        if (!sess || !('ok' in sess) || !sess.ok) return;

        try {
          const r = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              action: btn.action,
              args: btn.args || {},
              context: {
                staff_id: sess.staff_id,
                dorm_id: sess.dorm_id,
                role: sess.role,
                session_id: sess.session_id,
              },
            }),
          });
          const j: AgentReply = await r.json().catch(() => ({
            ok: false,
            error: 'bad_json',
          }));
          pushAgentReply(j);
        } catch (e: any) {
          setLogs((prev) => [
            ...prev,
            {
              from: 'agent',
              text: `❌ เรียกใช้งานไม่สำเร็จ: ${String(e?.message || e)}`,
            },
          ]);
        }
      }
    },
    [ensureSession, pushAgentReply],
  );

  return { logs, sendText, clickAction };
}
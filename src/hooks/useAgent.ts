// src/hooks/useAgent.ts
'use client';
import { useEffect, useRef, useState } from 'react';

export type AgentAction =
  | { type: 'postback'; label: string; action: string; args?: any }
  | { type: 'open_url'; label: string; url: string };

export type ChatLog = { from: 'user'|'agent'; text: string; actions?: AgentAction[] };

export function useAgent() {
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [sending, setSending] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // subscribe SSE หนึ่งครั้ง
  useEffect(() => {
    if (esRef.current) return;
    const es = new EventSource('/api/ai/events');
    es.addEventListener('open', () => {/* ok */});
    es.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data || '{}');
        if (msg?.message) {
          setLogs((prev) => [...prev, { from:'agent', text:String(msg.message), actions:msg.actions || [] }]);
        }
      } catch {/* ignore */}
    });
    es.addEventListener('error', () => {/* keep alive handled server side */});
    esRef.current = es;
    return () => { es.close(); esRef.current = null; };
  }, []);

  const sendText = async (text: string) => {
    setLogs((prev) => [...prev, { from:'user', text }]);
    setSending(true);
    try {
      const r = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type':'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await r.json().catch(() => ({}));
      if (data?.message) {
        setLogs((prev) => [...prev, { from:'agent', text: String(data.message), actions: data.actions || [] }]);
      }
    } finally {
      setSending(false);
    }
  };

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
        body: JSON.stringify({ action: a.action, args: a.args || {} }),
      });
      const data = await r.json().catch(() => ({}));
      if (data?.message) {
        setLogs((prev) => [...prev, { from:'agent', text:String(data.message), actions:data.actions || [] }]);
      }
    } finally {
      setSending(false);
    }
  };

  return { logs, sendText, clickAction, sending };
}
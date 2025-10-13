// src/components/AgentChat.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useAgent, AgentAction } from '../hooks/useAgent';

type ChatRow = {
  from: 'user' | 'agent' | 'system';
  text: string;
  actions?: AgentAction[];
};

export default function AgentChat() {
  const { logs, sendText, clickAction } = useAgent();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // ส่งข้อความถึงเอเยนต์
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    try {
      await sendText(msg); // API: /api/ai/chat -> n8n -> agent
      setText('');
    } finally {
      setSending(false);
    }
  };

  // กดปุ่ม Action (postback/open_url)
  const onClickAction = async (a: AgentAction) => {
    if (sending) return;
    setSending(true);
    try {
      await clickAction(a);
    } finally {
      setSending(false);
    }
  };

  // เลื่อนอัตโนมัติลงล่างสุดเมื่อมีข้อความใหม่
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div className="ai-card" role="region" aria-label="NEXRoom AI Agent">
      <div className="ai-card-title">🤖 NEXRoom AI</div>

      <div className="ai-chat" ref={listRef}>
        {logs.map((m: ChatRow, i: number) => (
          <div key={i} className={`row ${m.from}`}>
            <div className="bubble">{m.text}</div>

            {m.actions?.length ? (
              <div className="actions">
                {m.actions.map((b, j) => (
                  <button
                    key={j}
                    type="button"
                    className="cta"
                    onClick={() => onClickAction(b)}
                    aria-label={b.label}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}

        {sending ? (
          <div className="row agent">
            <div className="bubble bubble-pulse" aria-live="polite">
              กำลังคิดงานให้คุณ…
            </div>
          </div>
        ) : null}
      </div>

      <form className="inputbar" onSubmit={onSubmit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="พิมพ์คุยกับผู้ช่วย… (เช่น “เปิดระบบจอง”, “ออกบิลรอบนี้”)"
          aria-label="พิมพ์ข้อความถึง AI Agent"
        />
        <button type="submit" disabled={!text.trim() || sending}>
          {sending ? '…' : 'ส่ง'}
        </button>
      </form>

      <style jsx>{`
        .ai-card {
          position: relative;
          border-radius: 16px;
          padding: 14px 14px 12px;
          background: rgba(25, 18, 40, 0.65);
          overflow: hidden;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 122, 0, 0.25);
        }
        .ai-card::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: 18px;
          padding: 2px;
          background: linear-gradient(
            90deg,
            rgba(255, 122, 0, 0) 0%,
            rgba(255, 122, 0, 0.75) 50%,
            rgba(255, 122, 0, 0) 100%
          );
          -webkit-mask: linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: run 2.2s linear infinite;
          pointer-events: none;
        }
        @keyframes run {
          0% {
            background-position: -120% 0;
          }
          100% {
            background-position: 220% 0;
          }
        }

        .ai-card-title {
          font-weight: 700;
          color: #f6f2ff;
          margin: 0 4px 10px;
          opacity: 0.95;
          letter-spacing: 0.2px;
        }

        .ai-chat {
          height: 260px;
          overflow-y: auto;
          padding: 8px;
          border-radius: 12px;
          background: radial-gradient(
              1200px 400px at 10% 0%,
              rgba(255, 122, 0, 0.05),
              transparent 50%
            ),
            linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .row {
          display: flex;
          margin: 8px 0;
        }
        .row.user {
          justify-content: flex-end;
        }
        .row.agent,
        .row.system {
          justify-content: flex-start;
        }

        .bubble {
          max-width: 78%;
          padding: 10px 12px;
          border-radius: 12px;
          line-height: 1.45;
          font-size: 14px;
          color: #0c0718;
          background: #ffe9d6;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
          white-space: pre-wrap;
        }
        .row.agent .bubble,
        .row.system .bubble {
          color: #f6f2ff;
          background: #2a1f3f;
          border: 1px solid rgba(255, 122, 0, 0.25);
        }
        .bubble-pulse {
          position: relative;
        }
        .bubble-pulse::after {
          content: ' ';
          display: inline-block;
          margin-left: 8px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: rgba(255, 122, 0, 0.65);
          box-shadow: 0 0 12px rgba(255, 122, 0, 0.6);
          animation: pulse 1.1s ease-in-out infinite;
        }
        @keyframes pulse {
          0% {
            transform: scale(0.85);
            opacity: 0.5;
          }
          50% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(0.85);
            opacity: 0.5;
          }
        }

        .actions {
          display: flex;
          gap: 8px;
          margin: 6px 4px 0;
          flex-wrap: wrap;
        }
        .cta {
          padding: 6px 10px;
          border-radius: 10px;
          border: 1px solid rgba(255, 122, 0, 0.45);
          background: linear-gradient(
            180deg,
            rgba(255, 122, 0, 0.18),
            rgba(255, 122, 0, 0.08)
          );
          color: #ffd9b7;
          font-size: 12px;
          cursor: pointer;
          transition: 0.2s;
        }
        .cta:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(255, 122, 0, 0.15);
        }

        .inputbar {
          margin-top: 10px;
          display: flex;
          gap: 8px;
          align-items: center;
          background: #1f1733;
          border: 1px solid rgba(255, 122, 0, 0.3);
          border-radius: 12px;
          padding: 8px;
        }
        .inputbar input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          color: #fff;
          caret-color: #ff7a00;
          font-size: 14px;
        }
        .inputbar input::placeholder {
          color: #ffffff66;
        }
        .inputbar button {
          border: 0;
          border-radius: 10px;
          padding: 8px 12px;
          background: linear-gradient(180deg, #ff9a3c, #ff7a00);
          color: #1a102d;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 6px 16px rgba(255, 122, 0, 0.25);
          transition: 0.2s;
        }
        .inputbar button[disabled] {
          opacity: 0.6;
          cursor: default;
        }
        .inputbar button:hover:not([disabled]) {
          filter: brightness(1.05);
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}
'use client';
import { useEffect, useRef, useState } from 'react';
import { useAgent, AgentAction } from '../hooks/useAgent';

export default function AgentChat() {
  const { logs, sendText, clickAction } = useAgent();
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendText(text.trim());
    setText('');
  };

  // เลื่อนอัตโนมัติลงล่างสุดเมื่อมีข้อความใหม่
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div className="ai-card">
      <div className="ai-card-title">🤖 NEXRoom AI Agent</div>

      <div className="ai-chat" ref={listRef}>
        {logs.map((m, i) => (
          <div key={i} className={`row ${m.from}`}>
            <div className="bubble">{m.text}</div>
            {m.actions?.length ? (
              <div className="actions">
                {m.actions.map((b: AgentAction, j: number) => (
                  <button key={j} className="cta" onClick={() => clickAction(b)}>
                    {b.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <form className="inputbar" onSubmit={onSubmit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="พิมพ์คุยกับผู้ช่วย..."
        />
        <button type="submit">ส่ง</button>
      </form>

      <style jsx>{`
        .ai-card{
          position: relative;
          border-radius: 16px;
          padding: 14px 14px 12px;
          background: rgba(25,18,40,0.65);
          overflow: hidden;
          box-shadow: 0 8px 30px rgba(0,0,0,.35);
          border: 1px solid rgba(255,122,0,.25);
        }
        .ai-card::before{
          content:"";
          position:absolute; inset:-2px;
          border-radius:18px;
          padding:2px;
          background:
            linear-gradient(90deg,
              rgba(255,122,0,.0) 0%,
              rgba(255,122,0,.75) 50%,
              rgba(255,122,0,.0) 100%);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
                  mask-composite: exclude;
          animation: run 2.2s linear infinite;
          pointer-events:none;
        }
        @keyframes run { 0%{background-position:-120% 0} 100%{background-position:220% 0} }

        .ai-card-title{ font-weight:600; color:#f6f2ff; margin:0 4px 10px; opacity:.9; }

        .ai-chat{
          height: 260px;
          overflow-y: auto;
          padding: 8px;
          border-radius: 12px;
          background: radial-gradient(1200px 400px at 10% 0%, rgba(255,122,0,.05), transparent 50%);
          border: 1px solid rgba(255,255,255,.08);
        }
        .row { display:flex; margin: 8px 0; }
        .row.user{ justify-content:flex-end; }
        .row.agent{ justify-content:flex-start; }

        .bubble{
          max-width: 78%;
          padding: 10px 12px;
          border-radius: 12px;
          line-height: 1.45;
          font-size: 14px;
          color:#0c0718;
          background: #ffe9d6; /* ผู้ใช้: ส้มอ่อนอ่านชัด */
          box-shadow: 0 2px 10px rgba(0,0,0,.15);
        }
        .row.agent .bubble{
          color:#f6f2ff;
          background: #2a1f3f;
          border: 1px solid rgba(255,122,0,.25);
        }

        .actions{ display:flex; gap:8px; margin:6px 4px 0; flex-wrap: wrap; }
        .cta{
          padding: 6px 10px;
          border-radius: 10px;
          border: 1px solid rgba(255,122,0,.45);
          background: linear-gradient(180deg, rgba(255,122,0,.18), rgba(255,122,0,.08));
          color:#ffd9b7;
          font-size: 12px;
          cursor: pointer;
          transition: .2s;
        }
        .cta:hover{ transform: translateY(-1px); box-shadow: 0 4px 16px rgba(255,122,0,.15); }

        .inputbar{
          margin-top: 10px;
          display:flex; gap:8px; align-items:center;
          background: #1f1733;
          border: 1px solid rgba(255,122,0,.3);
          border-radius: 12px;
          padding: 8px;
        }
        .inputbar input{
          flex:1;
          border:none; outline:none; background:transparent;
          color:#fff; caret-color:#ff7a00; font-size:14px;
        }
        .inputbar input::placeholder{ color:#ffffff66; }
        .inputbar button{
          border:0; border-radius:10px; padding:8px 12px;
          background: linear-gradient(180deg, #ff9a3c, #ff7a00);
          color:#1a102d; font-weight:700; cursor:pointer;
          box-shadow: 0 6px 16px rgba(255,122,0,.25);
          transition:.2s;
        }
        .inputbar button:hover{ filter:brightness(1.05); transform:translateY(-1px); }
      `}</style>
    </div>
  );
}
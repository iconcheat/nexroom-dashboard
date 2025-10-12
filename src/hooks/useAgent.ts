import { useState } from 'react';

type ActionBtn = { type:'postback'|'open_url', label:string, action?:string, args?:any, url?:string };

export function useAgent() {
  const [logs, setLogs] = useState<{from:'user'|'agent', text:string, actions?:ActionBtn[]}[]>([]);

  async function sendText(text: string, ctx:any={}) {
    setLogs(s => [...s, { from:'user', text }]);
    const r = await fetch('/api/agent', {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ text, ...ctx })
    });
    const json = await r.json();
    if (json.ok) setLogs(s => [...s, { from:'agent', text: json.message, actions: json.actions }]);
  }

  async function clickAction(btn: ActionBtn, ctx:any={}) {
    if (btn.type === 'open_url' && btn.url) {
      window.open(btn.url, '_blank'); return;
    }
    setLogs(s => [...s, { from:'user', text: btn.label }]);
    const r = await fetch('/api/agent', {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ action: btn.action, args: btn.args, ...ctx })
    });
    const json = await r.json();
    if (json.ok) setLogs(s => [...s, { from:'agent', text: json.message, actions: json.actions }]);
  }

  return { logs, sendText, clickAction };
}
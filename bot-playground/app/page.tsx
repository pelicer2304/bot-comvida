'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { BotResponse, ChatEntry } from '@/lib/types';
import ChatMessage from '@/components/ChatMessage';

const DEFAULT_PHONE = 'playground-' + Math.random().toString(36).slice(2, 8);

export default function Home() {
  const [phone, setPhone] = useState(DEFAULT_PHONE);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<{ phone: string; step: string; updatedAt: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions');
      setSessions(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  async function send(text: string, buttonId?: string) {
    if (loading) return;
    const display = buttonId ?? text;
    if (!display) return;

    setMessages(prev => [...prev, { role: 'user', content: display, ts: new Date().toISOString() }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message: buttonId ? undefined : text, buttonId }),
      });
      const data = await res.json();
      const responses = data.responses as BotResponse[];
      if (responses?.length) {
        setMessages(prev => [...prev, { role: 'bot', content: '', responses, ts: new Date().toISOString() }]);
      }
      fetchSessions();
    } catch {
      setMessages(prev => [...prev, { role: 'bot', content: '❌ Erro ao conectar com o bot.', ts: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  }

  function loadSession(p: string) {
    setPhone(p);
    setMessages([]);
  }

  function newSession() {
    const id = 'playground-' + Math.random().toString(36).slice(2, 8);
    setPhone(id);
    setMessages([]);
  }

  return (
    <div className="flex h-screen text-sm">
      {/* Sidebar */}
      <aside className="w-72 bg-[#202c33] flex flex-col border-r border-[#2a3942]">
        <div className="p-4 border-b border-[#2a3942] flex items-center justify-between">
          <span className="text-[#e9edef] font-semibold">Sessões</span>
          <button onClick={newSession} className="text-[#00a884] text-xs px-2 py-1 rounded border border-[#00a884] hover:bg-[#00a884] hover:text-white transition-colors">
            + Nova
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.map(s => (
            <button
              key={s.phone}
              onClick={() => loadSession(s.phone)}
              className={`w-full text-left px-4 py-3 border-b border-[#2a3942] hover:bg-[#2a3942] transition-colors ${phone === s.phone ? 'bg-[#2a3942]' : ''}`}
            >
              <div className="text-[#e9edef] text-xs font-mono truncate">{s.phone}</div>
              <div className="text-[#8696a0] text-[10px] mt-0.5">step: {s.step}</div>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat */}
      <main className="flex-1 flex flex-col">
        <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3 border-b border-[#2a3942]">
          <div className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center text-white font-bold">C</div>
          <div>
            <div className="text-[#e9edef] font-medium">Bot Playground</div>
            <div className="text-[#8696a0] text-xs font-mono">{phone}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1" style={{ backgroundColor: '#0b141a' }}>
          {messages.length === 0 && !loading && (
            <div className="flex items-center justify-center h-full">
              <div className="bg-[#182229] text-[#8696a0] text-xs px-4 py-2 rounded-lg">
                Envie uma mensagem para iniciar
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <ChatMessage
              key={i}
              role={msg.role}
              text={msg.content}
              responses={msg.responses}
              onAction={(id) => send(id, id)}
            />
          ))}

          {loading && (
            <div className="flex justify-start mb-1">
              <div className="bg-[#202c33] rounded-lg rounded-tl-none px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
            placeholder="Digite uma mensagem"
            disabled={loading}
            className="flex-1 bg-[#2a3942] text-[#e9edef] placeholder-[#8696a0] rounded-lg px-4 py-2.5 outline-none text-sm disabled:opacity-50"
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="w-10 h-10 bg-[#00a884] hover:bg-[#06cf9c] disabled:bg-[#2a3942] rounded-full flex items-center justify-center transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white rotate-45">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </main>
    </div>
  );
}

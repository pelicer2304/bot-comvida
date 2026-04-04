'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: string;
}

interface SessionMeta {
  id: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export default function Home() {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchSessions = useCallback(async () => {
    const res = await fetch('/api/sessions');
    setSessions(await res.json());
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function loadSession(id: string) {
    setActiveSessionId(id);
    const res = await fetch(`/api/chat?sessionId=${id}`);
    const session = await res.json();
    const msgs: ChatMessage[] = session.messages
      .filter((m: { role: string }) => m.role === 'user' || m.role === 'assistant')
      .map((m: { role: 'user' | 'assistant'; content: string; tool_calls?: unknown[] }) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : '',
        ts: '',
      }))
      .filter((m: ChatMessage) => m.content);
    setMessages(msgs);
  }

  function newSession() {
    const id = uuidv4();
    setActiveSessionId(id);
    setMessages([]);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const sessionId = activeSessionId || uuidv4();
    if (!activeSessionId) setActiveSessionId(sessionId);

    const userMsg: ChatMessage = { role: 'user', content: text, ts: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply, ts: new Date().toISOString() }]);
      }
      fetchSessions();
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: '❌ Erro ao conectar. Verifique se o MCP server está rodando.', ts: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(iso: string) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatSessionDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="flex h-screen text-sm">
      {/* Sidebar */}
      <aside className="w-80 bg-[#202c33] flex flex-col border-r border-[#2a3942]">
        <div className="p-4 border-b border-[#2a3942] flex items-center justify-between">
          <span className="text-[#e9edef] font-semibold text-base">Conversas</span>
          <button
            onClick={newSession}
            className="text-[#00a884] hover:text-[#06cf9c] text-xs font-medium px-3 py-1 rounded-full border border-[#00a884] hover:border-[#06cf9c] transition-colors"
          >
            + Nova
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 && (
            <p className="text-[#8696a0] text-xs p-4">Nenhuma conversa ainda</p>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => loadSession(s.id)}
              className={`w-full text-left px-4 py-3 border-b border-[#2a3942] hover:bg-[#2a3942] transition-colors ${activeSessionId === s.id ? 'bg-[#2a3942]' : ''}`}
            >
              <div className="flex justify-between items-center">
                <span className="text-[#e9edef] truncate text-xs font-mono">{s.id.slice(0, 8)}…</span>
                <span className="text-[#8696a0] text-[10px] ml-2 shrink-0">{formatSessionDate(s.updatedAt)}</span>
              </div>
              <div className="text-[#8696a0] text-[11px] mt-0.5">{s.messageCount} mensagens</div>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat area */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3 border-b border-[#2a3942]">
          <div className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center text-white font-bold text-sm">C</div>
          <div>
            <div className="text-[#e9edef] font-medium">Clínica Comvida</div>
            <div className="text-[#8696a0] text-xs">Assistente de Agendamento</div>
          </div>
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23182229' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")", backgroundColor: '#0b141a' }}
        >
          {messages.length === 0 && !loading && (
            <div className="flex items-center justify-center h-full">
              <div className="bg-[#182229] text-[#8696a0] text-xs px-4 py-2 rounded-lg text-center">
                Inicie uma conversa para agendar sua consulta
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-1`}>
              <div
                className={`max-w-[70%] px-3 py-2 rounded-lg text-[#e9edef] text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user' ? 'bg-[#005c4b] rounded-tr-none' : 'bg-[#202c33] rounded-tl-none'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.ts && (
                  <span className="text-[#8696a0] text-[10px] float-right ml-2 mt-1">{formatDate(msg.ts)}</span>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start mb-1">
              <div className="bg-[#202c33] rounded-lg rounded-tl-none px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center">
                  <span className="w-2 h-2 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Digite uma mensagem"
            disabled={loading}
            className="flex-1 bg-[#2a3942] text-[#e9edef] placeholder-[#8696a0] rounded-lg px-4 py-2.5 outline-none text-sm disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
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

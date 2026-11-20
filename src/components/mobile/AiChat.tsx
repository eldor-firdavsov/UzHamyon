'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, PiggyBank, SquarePen, Sparkles, Target, TrendingDown } from 'lucide-react';
import { haptic } from '@/lib/ui/haptics';

interface Msg {
  id: string;
  role: 'me' | 'ai';
  text: string;
  error?: boolean;
}

interface AiChatProps {
  isAuthenticated: boolean;
  getAuthToken: () => Promise<string | null | undefined>;
  /** Called after an answer arrives: the AI may have added or changed data. */
  onAnswered?: () => void;
}

const STARTERS = [
  { text: 'Pulim qayerga ketyapti?', Icon: TrendingDown },
  { text: 'Shu oy tejadimmi?', Icon: PiggyBank },
  { text: 'Maqsadimga qachon yetaman?', Icon: Target },
];

let seq = 0;
const nextId = () => `m${Date.now()}-${seq++}`;

/** Chat with the finance assistant: a question, a short answer, three starter chips. */
export default function AiChat({ isAuthenticated, getAuthToken, onAnswered }: AiChatProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const ask = async (raw: string) => {
    const question = raw.trim();
    if (!question || busy) return;
    haptic('light');
    setInput('');
    setMessages((m) => [...m, { id: nextId(), role: 'me', text: question }]);

    if (!isAuthenticated) {
      setMessages((m) => [...m, { id: nextId(), role: 'ai', text: 'AI uchun Telegram orqali kiring.', error: true }]);
      return;
    }

    setBusy(true);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ question, conversationId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        answer?: string;
        error?: string;
        response?: { conversationId?: string };
      };
      if (!res.ok || !data.answer) {
        throw new Error(data.error || 'Javob kelmadi');
      }
      if (data.response?.conversationId) setConversationId(data.response.conversationId);
      setMessages((m) => [...m, { id: nextId(), role: 'ai', text: data.answer! }]);
      haptic('success');
      onAnswered?.();
    } catch {
      setMessages((m) => [...m, { id: nextId(), role: 'ai', text: 'Hozir javob bera olmadim. Qayta urinib ko‘ring.', error: true }]);
      haptic('warning');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setConversationId(undefined);
  };

  return (
    <div className="uz-ai">
      <div className="uz-ai-thread" aria-live="polite">
        {messages.length === 0 ? (
          <div className="uz-ai-hello">
            <span className="uz-ai-badge"><Sparkles size={28} strokeWidth={2} /></span>
            <span className="uz-ai-hello-title">Nima haqida so‘raymiz?</span>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="uz-ai-msg" data-role={m.role} data-error={m.error ? 'true' : undefined}>
              {m.text}
            </div>
          ))
        )}
        {busy && (
          <div className="uz-ai-msg uz-ai-typing" data-role="ai" aria-label="Yozmoqda">
            <span /><span /><span />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="uz-ai-dock">
        {messages.length === 0 && (
          <div className="uz-ai-chips">
            {STARTERS.map(({ text, Icon }) => (
              <button key={text} type="button" className="uz-ai-chip" onClick={() => void ask(text)}>
                <Icon size={15} strokeWidth={2.2} aria-hidden="true" />
                {text}
              </button>
            ))}
          </div>
        )}
        <form
          className="uz-ai-bar"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
        >
          {messages.length > 0 && (
            <button type="button" className="uz-ai-round" aria-label="Yangi suhbat" onClick={reset} disabled={busy}>
              <SquarePen size={18} strokeWidth={2.2} />
            </button>
          )}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Savol bering…"
            aria-label="Savol"
            maxLength={1000}
            enterKeyHint="send"
          />
          <button type="submit" className="uz-ai-send" aria-label="Yuborish" disabled={!input.trim() || busy}>
            <ArrowUp size={22} strokeWidth={2.6} />
          </button>
        </form>
      </div>
    </div>
  );
}

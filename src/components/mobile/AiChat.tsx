'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Calculator, PenLine, PiggyBank, Search, SquarePen, Sparkles, Target, TrendingDown } from 'lucide-react';
import { haptic } from '@/lib/ui/haptics';
import { useI18n } from '@/lib/i18n/client';

interface Msg {
  id: string;
  role: 'me' | 'ai';
  text: string;
  error?: boolean;
  /** Just arrived: reveal it word by word. */
  fresh?: boolean;
}

interface AiChatProps {
  isAuthenticated: boolean;
  getAuthToken: () => Promise<string | null | undefined>;
  /** Called after an answer arrives: the AI may have added or changed data. */
  onAnswered?: () => void;
}

const STARTER_ICONS = [TrendingDown, PiggyBank, Target];

/** Loading steps, Claude-style: one shimmering line that moves on while the answer is prepared. */
const STEPS = [
  { at: 0, Icon: Sparkles },
  { at: 1800, Icon: Search },
  { at: 4500, Icon: Calculator },
  { at: 9000, Icon: PenLine },
];

function Thinking() {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = window.setInterval(() => {
      const ms = Date.now() - start;
      let next = 0;
      STEPS.forEach((s, i) => {
        if (ms >= s.at) next = i;
      });
      setStep(next);
      setSecs(Math.floor(ms / 1000));
    }, 250);
    return () => window.clearInterval(timer);
  }, []);
  const { Icon } = STEPS[step];
  const label = t.ai.steps[step];
  return (
    <div className="uz-ai-think" role="status" aria-live="polite">
      <span className="uz-ai-think-ic" key={step}><Icon size={16} strokeWidth={2.2} aria-hidden="true" /></span>
      <span className="uz-ai-shimmer">{label}…</span>
      {secs >= 6 && <span className="uz-ai-think-secs">{secs}s</span>}
    </div>
  );
}

/** **bold** → <b>; everything else as text. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') && p.length > 4 ? <b key={i}>{p.slice(2, -2)}</b> : <React.Fragment key={i}>{p}</React.Fragment>
      )}
    </>
  );
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Reveals a fresh answer word by word (about 0.6 s for a short reply), then shows it whole. */
function Reveal({ text, onDone }: { text: string; onDone: () => void }) {
  const [shown, setShown] = useState(0);
  const words = text.split(/(\s+)/);
  useEffect(() => {
    if (prefersReducedMotion()) {
      onDone();
      return;
    }
    const perTick = Math.max(1, Math.ceil(words.length / 40));
    const timer = window.setInterval(() => {
      setShown((n) => {
        const next = n + perTick;
        if (next >= words.length) {
          window.clearInterval(timer);
          window.setTimeout(onDone, 0);
        }
        return next;
      });
    }, 16);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <RichText text={words.slice(0, shown).join('')} />;
}

let seq = 0;
const nextId = () => `m${Date.now()}-${seq++}`;

/** Chat with the finance assistant: a question, a short answer, three starter chips. */
export default function AiChat({ isAuthenticated, getAuthToken, onAnswered }: AiChatProps) {
  const { t } = useI18n();
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
      setMessages((m) => [...m, { id: nextId(), role: 'ai', text: t.ai.loginRequired, error: true }]);
      return;
    }

    setBusy(true);
    try {
      const token = await getAuthToken();
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 45000);
      const res = await fetch('/api/ai/advisor', {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ question, conversationId }),
      }).finally(() => window.clearTimeout(timeout));
      const data = (await res.json().catch(() => ({}))) as {
        answer?: string;
        error?: string;
        response?: { conversationId?: string };
      };
      if (!res.ok || !data.answer) {
        throw new Error(data.error || 'Javob kelmadi');
      }
      if (data.response?.conversationId) setConversationId(data.response.conversationId);
      setMessages((m) => [...m, { id: nextId(), role: 'ai', text: data.answer!.trim(), fresh: true }]);
      haptic('success');
      onAnswered?.();
    } catch {
      setMessages((m) => [...m, { id: nextId(), role: 'ai', text: t.ai.failed, error: true }]);
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
            <span className="uz-ai-hello-title">{t.ai.hello}</span>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="uz-ai-msg" data-role={m.role} data-error={m.error ? 'true' : undefined}>
              {m.role === 'ai' && m.fresh ? (
                <Reveal text={m.text} onDone={() => setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, fresh: false } : x)))} />
              ) : m.role === 'ai' ? (
                <RichText text={m.text} />
              ) : (
                m.text
              )}
            </div>
          ))
        )}
        {busy && <Thinking />}
        <div ref={endRef} />
      </div>

      <div className="uz-ai-dock">
        {messages.length === 0 && (
          <div className="uz-ai-chips">
            {t.ai.starters.map((text, i) => {
              const Icon = STARTER_ICONS[i] ?? Sparkles;
              return (
              <button key={text} type="button" className="uz-ai-chip" onClick={() => void ask(text)}>
                <Icon size={15} strokeWidth={2.2} aria-hidden="true" />
                {text}
              </button>
              );
            })}
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
            <button type="button" className="uz-ai-round" aria-label={t.ai.newChat} onClick={reset} disabled={busy}>
              <SquarePen size={18} strokeWidth={2.2} />
            </button>
          )}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.ai.placeholder}
            aria-label={t.ai.question}
            maxLength={1000}
            enterKeyHint="send"
          />
          <button type="submit" className="uz-ai-send" aria-label={t.ai.send} disabled={!input.trim() || busy}>
            <ArrowUp size={22} strokeWidth={2.6} />
          </button>
        </form>
      </div>
    </div>
  );
}

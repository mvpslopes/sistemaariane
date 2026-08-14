import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Send, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAiAssistant } from '../contexts/AiAssistantContext';
import { useToast } from '../contexts/ToastContext';
import { askAssistant, type AssistantMessage } from '../services/apiService';
import { buildAssistantKnowledge, suggestedAssistantPrompts } from '../utils/assistantContext';
import { useIsMobile } from '../hooks/useIsMobile';
import AssistantMark from './AssistantMark';

const LINK_PATTERN = /\[LINK:([^\]|]+)\|([^\]]+)\]/g;

function renderReply(text: string) {
  const parts: Array<{ type: 'text' | 'link'; value: string; to?: string }> = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(LINK_PATTERN.source, 'g');
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: 'text', value: text.slice(last, match.index) });
    }
    parts.push({ type: 'link', to: match[1].trim(), value: match[2].trim() });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  if (parts.length === 0) return text;
  return parts.map((p, i) =>
    p.type === 'link' && p.to ? (
      <Link
        key={i}
        to={p.to}
        className="mt-2 inline-flex rounded-lg bg-brand-brown px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-olive"
      >
        {p.value}
      </Link>
    ) : (
      <span key={i}>{p.value}</span>
    )
  );
}

function stripLinkMarkers(text: string) {
  return text.replace(LINK_PATTERN, '').trim();
}

export default function AiAssistantFab() {
  const { open, closeAssistant, toggleAssistant } = useAiAssistant();
  const { user, hasRole } = useAuth();
  const { error: toastError } = useToast();
  const isMobile = useIsMobile();
  const panelRef = useRef<HTMLDivElement>(null);

  const isCliente = hasRole('cliente');
  const isAssessor = !!user?.isAssessor && isCliente;
  const ctx = { isCliente, isAssessor };

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: 'assistant',
      content:
        'Olá! Sou o Assistente Ariane, copiloto do Gestão de Haras. Posso explicar cadastros, contratos, cobranças, registro diário e navegação no sistema. Como posso ajudar?',
    },
  ]);

  const knowledge = buildAssistantKnowledge(ctx);
  const suggestions = suggestedAssistantPrompts(ctx);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAssistant();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, closeAssistant]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: AssistantMessage = { role: 'user', content: trimmed };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    try {
      const { reply } = await askAssistant({
        messages: nextHistory.filter((m) => m.role === 'user' || m.role === 'assistant'),
        context: knowledge,
        userName: user?.name,
        userRole: user?.role,
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      toastError(err.message || 'Assistente indisponível no momento');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Não consegui processar agora. Tente de novo em instantes ou use Suporte no menu superior para falar com a equipe técnica.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const bottomClass = isMobile ? 'bottom-[calc(5.5rem+env(safe-area-inset-bottom))]' : 'bottom-6';

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[42] bg-black/25 md:bg-transparent"
          aria-hidden
          onClick={closeAssistant}
        />
      )}

      <div className={`fixed right-4 z-[43] flex flex-col items-end gap-3 ${bottomClass}`}>
        {open && (
          <div
            ref={panelRef}
            className="flex w-[min(100vw-2rem,24rem)] flex-col overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-2xl sm:w-96"
            role="dialog"
            aria-label="Assistente Ariane"
          >
            <header className="flex items-center justify-between gap-2 border-b border-brand-beige bg-gradient-to-r from-brand-dark-brown to-[#3d2f26] px-4 py-3 text-white">
              <div className="flex min-w-0 items-center gap-2">
                <AssistantMark size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">Assistente Ariane</p>
                  <p className="truncate text-[11px] text-brand-beige/70">Gestão de Haras · IA</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAssistant}
                className="rounded-lg p-1.5 text-brand-beige/80 hover:bg-white/10"
                aria-label="Fechar assistente"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex max-h-[min(50vh,22rem)] flex-col gap-3 overflow-y-auto px-3 py-3">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-brand-brown text-white'
                        : 'border border-brand-beige bg-brand-off-white text-brand-dark-brown'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="space-y-1 whitespace-pre-wrap">
                        {renderReply(stripLinkMarkers(msg.content))}
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-xs text-brand-olive">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Pensando…
                </div>
              )}
            </div>

            {messages.length <= 2 && (
              <div className="flex flex-wrap gap-1.5 border-t border-brand-beige/60 px-3 py-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    disabled={loading}
                    className="rounded-full border border-brand-beige bg-white px-2.5 py-1 text-[11px] text-brand-brown hover:bg-brand-off-white disabled:opacity-60"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <form
              className="flex items-end gap-2 border-t border-brand-beige p-3"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={1}
                placeholder="Pergunte sobre o sistema…"
                className="max-h-24 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-brand-beige px-3 py-2 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-brown text-white transition hover:bg-brand-olive disabled:opacity-50"
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        <button
          type="button"
          onClick={toggleAssistant}
          className={`theme-fixed flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition hover:scale-105 active:scale-95 ${
            open ? 'bg-brand-dark-brown text-white ring-2 ring-brand-gold/40' : ''
          }`}
          title="Assistente Ariane"
          aria-label={open ? 'Fechar assistente' : 'Abrir assistente Ariane'}
        >
          {open ? <X className="h-6 w-6" /> : <AssistantMark size="fab" className="h-14 w-14" />}
        </button>
      </div>
    </>
  );
}

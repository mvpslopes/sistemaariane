import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, CheckCheck, Loader2, MessageSquarePlus, Search, Send, Users } from 'lucide-react';
import {
  getChatContacts,
  getChatMessages,
  getChatThreads,
  markChatThreadRead,
  openChatThread,
  sendChatMessage,
  type ChatMessage,
  type ChatThread,
  type ChatUser,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useChatUnread } from '../../hooks/useChatUnread';
import { useIsMobile } from '../../hooks/useIsMobile';
import UserAvatar from '../../components/UserAvatar';
import Modal from '../../components/Modal';
import AppButton from '../../components/AppButton';
import { formatDateTimeBR } from '../../utils/dateTime';
import {
  formatReadReceiptLabel,
  getLastReadOwnMessageId,
  isMessageReadByPeer,
} from '../../utils/chatReadReceipt';
import { auditRoleLabel } from '../../constants/auditLabels';

const roleLabel = (role: string) => auditRoleLabel(role);

const CHAT_POLL_MS = 4000;

function threadPreview(text: string | null) {
  if (!text) return 'Nenhuma mensagem ainda';
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > 72 ? `${oneLine.slice(0, 69)}…` : oneLine;
}

export default function ChatPage() {
  const { threadId: threadIdParam } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { error: toastError } = useToast();
  const isMobile = useIsMobile();
  const { refresh: refreshUnread } = useChatUnread(true);

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [activePeer, setActivePeer] = useState<ChatUser | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [contactQuery, setContactQuery] = useState('');
  const [contacts, setContacts] = useState<ChatUser[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [threadSearch, setThreadSearch] = useState('');
  const [peerLastReadAt, setPeerLastReadAt] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);

  const activeThreadId = threadIdParam || null;

  const loadThreads = useCallback(async () => {
    try {
      const { items } = await getChatThreads();
      setThreads(items);
    } catch (err: any) {
      toastError(err.message || 'Erro ao carregar conversas');
    } finally {
      setLoadingThreads(false);
    }
  }, [toastError]);

  const loadMessages = useCallback(
    async (threadId: string, silent = false) => {
      if (!silent) setLoadingMessages(true);
      try {
        const { items, peer, peerLastReadAt: peerReadAt } = await getChatMessages(threadId);
        setMessages(items);
        setActivePeer(peer);
        setPeerLastReadAt(peerReadAt);
        await markChatThreadRead(threadId);
        refreshUnread();
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, unreadCount: 0 } : t))
        );
      } catch (err: any) {
        if (!silent) toastError(err.message || 'Erro ao carregar mensagens');
      } finally {
        if (!silent) setLoadingMessages(false);
      }
    },
    [toastError, refreshUnread]
  );

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      setActivePeer(null);
      setPeerLastReadAt(null);
      return;
    }
    loadMessages(activeThreadId);
    pollRef.current = window.setInterval(() => loadMessages(activeThreadId, true), CHAT_POLL_MS);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [activeThreadId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeThreadId]);

  useEffect(() => {
    if (!newOpen) return;
    setLoadingContacts(true);
    const t = window.setTimeout(async () => {
      try {
        const { items } = await getChatContacts(contactQuery);
        setContacts(items);
      } catch (err: any) {
        toastError(err.message || 'Erro ao buscar contatos');
      } finally {
        setLoadingContacts(false);
      }
    }, contactQuery ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [newOpen, contactQuery, toastError]);

  const filteredThreads = useMemo(() => {
    const q = threadSearch.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        t.peer.name.toLowerCase().includes(q) ||
        t.peer.username.toLowerCase().includes(q) ||
        (t.lastMessage || '').toLowerCase().includes(q)
    );
  }, [threads, threadSearch]);

  const lastReadOwnMessageId = useMemo(
    () => getLastReadOwnMessageId(messages, peerLastReadAt),
    [messages, peerLastReadAt]
  );

  const openThread = (thread: ChatThread) => {
    navigate(`/app/mensagens/${thread.id}`);
  };

  const startWithContact = async (contact: ChatUser) => {
    try {
      const { thread } = await openChatThread(contact.id);
      setNewOpen(false);
      setContactQuery('');
      setThreads((prev) => {
        const exists = prev.some((t) => t.id === thread.id);
        if (exists) {
          return prev.map((t) => (t.id === thread.id ? { ...t, ...thread } : t));
        }
        return [thread, ...prev];
      });
      navigate(`/app/mensagens/${thread.id}`);
    } catch (err: any) {
      toastError(err.message || 'Erro ao iniciar conversa');
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !activeThreadId || sending) return;
    setSending(true);
    setInput('');
    try {
      const { message } = await sendChatMessage(activeThreadId, text);
      setMessages((prev) => [...prev, message]);
      setThreads((prev) =>
        prev
          .map((t) =>
            t.id === activeThreadId
              ? { ...t, lastMessage: text, lastMessageAt: message.createdAt, unreadCount: 0 }
              : t
          )
          .sort((a, b) => {
            const da = a.lastMessageAt || '';
            const db = b.lastMessageAt || '';
            return db.localeCompare(da);
          })
      );
    } catch (err: any) {
      setInput(text);
      toastError(err.message || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const showList = !isMobile || !activeThreadId;
  const showChat = !isMobile || !!activeThreadId;

  return (
    <div className="flex h-[min(72vh,calc(100dvh-10rem))] min-h-[420px] overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-sm">
      {showList && (
        <aside
          className={`flex flex-col border-brand-beige bg-brand-off-white/40 ${
            isMobile ? 'w-full' : 'w-full max-w-sm shrink-0 border-r'
          }`}
        >
          <div className="border-b border-brand-beige px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-brand-dark-brown">Mensagens</h2>
                <p className="text-xs text-brand-olive">Conversas com a equipe</p>
              </div>
              <button
                type="button"
                onClick={() => setNewOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-brown text-white transition hover:bg-brand-olive"
                title="Nova conversa"
                aria-label="Nova conversa"
              >
                <MessageSquarePlus className="h-4 w-4" />
              </button>
            </div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive/60" />
              <input
                value={threadSearch}
                onChange={(e) => setThreadSearch(e.target.value)}
                placeholder="Buscar conversa…"
                className="w-full rounded-xl border border-brand-beige bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingThreads ? (
              <div className="flex items-center justify-center py-12 text-sm text-brand-olive">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando…
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Users className="mx-auto h-8 w-8 text-brand-beige" />
                <p className="mt-3 text-sm font-medium text-brand-dark-brown">Nenhuma conversa</p>
                <p className="mt-1 text-xs text-brand-olive">Inicie um chat com alguém da equipe.</p>
                <AppButton className="mt-4" onClick={() => setNewOpen(true)}>
                  Nova conversa
                </AppButton>
              </div>
            ) : (
              <ul className="divide-y divide-brand-beige/70">
                {filteredThreads.map((thread) => (
                  <li key={thread.id}>
                    <button
                      type="button"
                      onClick={() => openThread(thread)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white ${
                        activeThreadId === thread.id ? 'bg-white ring-1 ring-inset ring-brand-beige' : ''
                      }`}
                    >
                      <UserAvatar name={thread.peer.name} avatarUrl={thread.peer.avatarUrl} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-brand-dark-brown">
                            {thread.peer.name}
                          </p>
                          {thread.lastMessageAt && (
                            <span className="shrink-0 text-[10px] text-brand-olive">
                              {formatDateTimeBR(thread.lastMessageAt, thread.lastMessageAt).split(' ')[1] ||
                                formatDateTimeBR(thread.lastMessageAt, thread.lastMessageAt)}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-brand-olive">{threadPreview(thread.lastMessage)}</p>
                      </div>
                      {thread.unreadCount > 0 && (
                        <span className="mt-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-brand-brown px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      )}

      {showChat && (
        <section className="flex min-w-0 flex-1 flex-col">
          {!activeThreadId ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <MessageSquarePlus className="h-10 w-10 text-brand-beige" />
              <p className="mt-4 text-sm font-medium text-brand-dark-brown">Selecione uma conversa</p>
              <p className="mt-1 max-w-xs text-xs text-brand-olive">
                Escolha alguém na lista ou inicie uma nova conversa para trocar mensagens dentro do sistema.
              </p>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-brand-beige px-4 py-3">
                {isMobile && (
                  <button
                    type="button"
                    onClick={() => navigate('/app/mensagens')}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-brand-beige text-brand-brown hover:bg-brand-off-white"
                    aria-label="Voltar"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                {activePeer && (
                  <>
                    <UserAvatar name={activePeer.name} avatarUrl={activePeer.avatarUrl} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-brand-dark-brown">{activePeer.name}</p>
                      <p className="truncate text-xs text-brand-olive">
                        @{activePeer.username} · {roleLabel(activePeer.role)}
                      </p>
                    </div>
                  </>
                )}
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-12 text-sm text-brand-olive">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando mensagens…
                  </div>
                ) : messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-brand-olive">
                    Envie a primeira mensagem para {activePeer?.name || 'este contato'}.
                  </p>
                ) : (
                  messages.map((msg) => {
                    const read = isMessageReadByPeer(msg, peerLastReadAt);
                    const showSeenLabel = msg.mine && msg.id === lastReadOwnMessageId && read;

                    return (
                      <div key={msg.id} className={`flex ${msg.mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                            msg.mine
                              ? 'bg-brand-brown text-white'
                              : 'border border-brand-beige bg-brand-off-white text-brand-dark-brown'
                          }`}
                        >
                          {!msg.mine && (
                            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-olive">
                              {msg.senderName}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                          <div
                            className={`mt-1 flex items-center justify-end gap-1 ${
                              msg.mine ? 'text-white/70' : 'text-brand-olive/80'
                            }`}
                          >
                            <span className="text-[10px]">
                              {formatDateTimeBR(msg.createdAt, msg.createdAt)}
                            </span>
                            {msg.mine && (
                              <span className="inline-flex items-center gap-0.5" title={read ? formatReadReceiptLabel(peerLastReadAt) : 'Enviada'}>
                                {read ? (
                                  <CheckCheck className="h-3.5 w-3.5 text-sky-300" strokeWidth={2.5} />
                                ) : (
                                  <Check className="h-3.5 w-3.5 opacity-70" strokeWidth={2.5} />
                                )}
                              </span>
                            )}
                          </div>
                          {showSeenLabel && (
                            <p className="mt-0.5 text-right text-[10px] text-sky-200/90">
                              {formatReadReceiptLabel(peerLastReadAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form
                className="flex items-end gap-2 border-t border-brand-beige p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={1}
                  placeholder="Escreva uma mensagem…"
                  className="max-h-28 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-brand-beige px-3 py-2 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-brown text-white transition hover:bg-brand-olive disabled:opacity-50"
                  aria-label="Enviar"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
            </>
          )}
        </section>
      )}

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nova conversa">
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive/60" />
            <input
              value={contactQuery}
              onChange={(e) => setContactQuery(e.target.value)}
              placeholder="Buscar por nome ou usuário…"
              className="w-full rounded-xl border border-brand-beige py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-xl border border-brand-beige">
            {loadingContacts ? (
              <div className="flex items-center justify-center py-8 text-sm text-brand-olive">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Buscando…
              </div>
            ) : contacts.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-brand-olive">Nenhum contato encontrado.</p>
            ) : (
              <ul className="divide-y divide-brand-beige/70">
                {contacts.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => startWithContact(c)}
                      disabled={c.id === user?.id}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-brand-off-white disabled:opacity-50"
                    >
                      <UserAvatar name={c.name} avatarUrl={c.avatarUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-brand-dark-brown">{c.name}</p>
                        <p className="truncate text-xs text-brand-olive">
                          @{c.username} · {roleLabel(c.role)}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

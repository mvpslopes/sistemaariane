import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getChatThreads } from '../services/apiService';
import { useToast } from '../contexts/ToastContext';
import { useChatUnread } from './useChatUnread';

const POLL_MS = 4000;

type ThreadSnapshot = {
  lastMessageAt: string | null;
  unreadCount: number;
};

function threadPreview(text: string | null, max = 60): string {
  if (!text) return 'Nova mensagem';
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

function activeChatThreadId(pathname: string): string | null {
  const match = pathname.match(/^\/app\/mensagens\/(\d+)/);
  return match ? match[1] : null;
}

async function showBrowserNotification(title: string, body: string, threadId: string) {
  if (typeof Notification === 'undefined' || document.visibilityState === 'visible') return;
  if (Notification.permission === 'granted') {
    const n = new Notification(title, {
      body,
      tag: `chat-${threadId}`,
      icon: '/icon-agent-ia.png',
    });
    n.onclick = () => {
      window.focus();
      window.location.href = `/app/mensagens/${threadId}`;
      n.close();
    };
    return;
  }
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

/**
 * Detecta mensagens novas em qualquer conversa e exibe toast + notificação do navegador.
 */
export function useChatMessageNotifications(enabled = true) {
  const { info } = useToast();
  const { refresh: refreshUnread } = useChatUnread(enabled, POLL_MS);
  const location = useLocation();
  const navigate = useNavigate();
  const snapshotRef = useRef<Map<string, ThreadSnapshot>>(new Map());
  const readyRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const { items } = await getChatThreads();
        if (cancelled) return;

        refreshUnread();

        const activeThreadId = activeChatThreadId(location.pathname);
        const prev = snapshotRef.current;
        const next = new Map<string, ThreadSnapshot>();

        for (const thread of items) {
          const snap: ThreadSnapshot = {
            lastMessageAt: thread.lastMessageAt,
            unreadCount: thread.unreadCount,
          };
          next.set(thread.id, snap);

          if (!readyRef.current) continue;

          const old = prev.get(thread.id);
          const hasNewUnread =
            thread.unreadCount > 0 &&
            (!old || thread.unreadCount > old.unreadCount || thread.lastMessageAt !== old.lastMessageAt);

          if (!hasNewUnread || thread.id === activeThreadId) continue;

          const preview = threadPreview(thread.lastMessage);
          const title = `${thread.peer.name}`;
          const message = preview;

          info(`${title}: ${message}`, {
            onClick: () => navigate(`/app/mensagens/${thread.id}`),
          });

          void showBrowserNotification(title, preview, thread.id);
        }

        snapshotRef.current = next;
        readyRef.current = true;
      } catch {
        /* chat pode não estar migrado ainda */
      }
    };

    poll();
    const id = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, info, location.pathname, navigate, refreshUnread]);
}

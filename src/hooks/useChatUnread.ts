import { useCallback, useEffect, useState } from 'react';
import { getChatUnreadCount } from '../services/apiService';

export function useChatUnread(enabled = true, intervalMs = 30000) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const { count: n } = await getChatUnreadCount();
      setCount(n);
    } catch {
      /* tabela pode não existir ainda */
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
    if (!enabled) return;
    const id = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs, refresh]);

  return { count, refresh };
}

import { useEffect } from 'react';
import { sendPresenceHeartbeat } from '../services/apiService';

const HEARTBEAT_MS = 60_000;

/** Mantém last_seen_at atualizado enquanto o usuário está logado. */
export function usePresenceHeartbeat(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const ping = () => {
      sendPresenceHeartbeat().catch(() => {
        /* migration pode não estar aplicada */
      });
    };

    ping();
    const id = window.setInterval(ping, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [enabled]);
}

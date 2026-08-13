import { useEffect, useState } from 'react';
import { getDashboard, type DashboardStats } from '../services/apiService';

const REFRESH_MS = 5 * 60 * 1000;

/** Carrega estatísticas do dashboard para alertas operacionais no header. */
export function useOperationalAlerts(enabled = true) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setStats(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = () => {
      getDashboard()
        .then((data) => {
          if (!cancelled) setStats(data);
        })
        .catch(() => {
          if (!cancelled) setStats(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  return { stats, loading };
}

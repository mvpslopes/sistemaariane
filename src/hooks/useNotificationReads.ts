import { useCallback, useMemo, useState } from 'react';
import type { DashboardStats } from '../services/apiService';
import {
  alertFingerprint,
  buildOperationalAlerts,
  type OperationalAlert,
} from '../utils/operationalAlerts';

type ReadMap = Record<string, string>;

function storageKey(userId: string) {
  return `notification_reads_${userId}`;
}

function loadReads(userId: string): ReadMap {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as ReadMap) : {};
  } catch {
    return {};
  }
}

function saveReads(userId: string, map: ReadMap) {
  localStorage.setItem(storageKey(userId), JSON.stringify(map));
}

export function useNotificationReads(
  userId: string | undefined,
  stats: DashboardStats | null,
  canManageSubs: boolean
) {
  const [reads, setReads] = useState<ReadMap>(() => (userId ? loadReads(userId) : {}));

  const alerts = useMemo(
    () => (stats ? buildOperationalAlerts(stats, canManageSubs) : []),
    [stats, canManageSubs]
  );

  const isUnread = useCallback(
    (alert: OperationalAlert) => {
      if (!stats) return false;
      const fp = alertFingerprint(alert, stats);
      return reads[alert.id] !== fp;
    },
    [reads, stats]
  );

  const unreadAlerts = useMemo(() => alerts.filter(isUnread), [alerts, isUnread]);
  const unreadCount = unreadAlerts.length;

  const markAsRead = useCallback(
    (alert: OperationalAlert) => {
      if (!userId || !stats) return;
      const fp = alertFingerprint(alert, stats);
      setReads((prev) => {
        const next = { ...prev, [alert.id]: fp };
        saveReads(userId, next);
        return next;
      });
    },
    [userId, stats]
  );

  const markAllAsRead = useCallback(() => {
    if (!userId || !stats) return;
    const next: ReadMap = { ...reads };
    alerts.forEach((a) => {
      next[a.id] = alertFingerprint(a, stats);
    });
    setReads(next);
    saveReads(userId, next);
  }, [userId, stats, alerts, reads]);

  return {
    alerts,
    unreadAlerts,
    unreadCount,
    isUnread,
    markAsRead,
    markAllAsRead,
  };
}

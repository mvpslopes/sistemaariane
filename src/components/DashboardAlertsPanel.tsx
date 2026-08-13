import { Link } from 'react-router-dom';
import { AlertTriangle, Bell, ChevronRight } from 'lucide-react';
import type { DashboardStats } from '../services/apiService';
import { buildOperationalAlerts } from '../utils/operationalAlerts';

export default function DashboardAlertsPanel({
  stats,
  canManageSubs,
}: {
  stats: DashboardStats;
  canManageSubs: boolean;
}) {
  const alerts = buildOperationalAlerts(stats, canManageSubs);
  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-800">
        <span className="font-medium">Tudo em dia.</span> Nenhum alerta operacional no momento.
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">
        <Bell className="h-3.5 w-3.5" /> Precisa de atenção
      </h3>
      <ul className="space-y-2">
        {alerts.map((a) => (
          <li key={a.id}>
            <Link
              to={a.to}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition hover:shadow-card ${
                a.tone === 'warn'
                  ? 'border-amber-200 bg-amber-50/80 text-amber-950'
                  : 'border-brand-beige bg-white text-neutral-950'
              }`}
            >
              <AlertTriangle
                className={`h-4 w-4 shrink-0 ${a.tone === 'warn' ? 'text-amber-600' : 'text-brand-olive'}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{a.title}</span>
                <span className="block text-xs opacity-80">{a.subtitle}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

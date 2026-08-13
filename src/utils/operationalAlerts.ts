import type { DashboardStats } from '../services/apiService';

export interface OperationalAlert {
  id: string;
  title: string;
  subtitle: string;
  to: string;
  tone: 'warn' | 'info';
}

/** Identificador da versão do alerta — muda quando o dado muda e o aviso volta a aparecer. */
export function alertFingerprint(alert: OperationalAlert, stats: DashboardStats): string {
  switch (alert.id) {
    case 'overdue':
      return String(stats.chargesOverdue ?? 0);
    case 'due-soon':
      return String(stats.chargesDueSoon ?? 0);
    case 'awaiting-sign':
      return String(stats.contractsAwaiting ?? 0);
    case 'auctions':
      return String(stats.auctionsOpen ?? 0);
    case 'suspended':
      return String(stats.subscriptionsSuspended ?? 0);
    case 'abccmm':
      return String(stats.coveringsPending ?? 0);
    default:
      return alert.title;
  }
}

export function buildOperationalAlerts(
  stats: DashboardStats,
  canManageSubs: boolean
): OperationalAlert[] {
  const items: OperationalAlert[] = [];

  if ((stats.chargesOverdue ?? 0) > 0) {
    items.push({
      id: 'overdue',
      title: `${stats.chargesOverdue} cobrança(s) atrasada(s)`,
      subtitle: 'Ver inadimplência e acionar clientes',
      to: '/app/recebiveis',
      tone: 'warn',
    });
  }
  if ((stats.chargesDueSoon ?? 0) > 0) {
    items.push({
      id: 'due-soon',
      title: `${stats.chargesDueSoon} parcela(s) vencem em 7 dias`,
      subtitle: 'Antecipe contato com compradores',
      to: '/app/cobrancas',
      tone: 'info',
    });
  }
  if ((stats.contractsAwaiting ?? 0) > 0) {
    items.push({
      id: 'awaiting-sign',
      title: `${stats.contractsAwaiting} contrato(s) aguardando assinatura`,
      subtitle: 'Enviar ou acompanhar Clicksign',
      to: '/app/contratos',
      tone: 'info',
    });
  }
  if ((stats.auctionsOpen ?? 0) > 0) {
    items.push({
      id: 'auctions',
      title: `${stats.auctionsOpen} leilão(ões) em andamento`,
      subtitle: 'Conferir lotes e financeiro',
      to: '/app/leiloes',
      tone: 'info',
    });
  }
  if (canManageSubs && (stats.subscriptionsSuspended ?? 0) > 0) {
    items.push({
      id: 'suspended',
      title: `${stats.subscriptionsSuspended} assinatura(s) suspensa(s)`,
      subtitle: 'Haras com acesso bloqueado por inadimplência',
      to: '/app/assinaturas',
      tone: 'warn',
    });
  }
  if ((stats.coveringsPending ?? 0) > 0) {
    items.push({
      id: 'abccmm',
      title: `${stats.coveringsPending} cobertura(s) com ABCCMM pendente`,
      subtitle: 'Comunicação manual — integração API futura',
      to: '/app/reproducao',
      tone: 'warn',
    });
  }

  return items.slice(0, 6);
}

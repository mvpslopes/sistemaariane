import type { Contract } from '../services/apiService';

/** Contrato criado mas ainda não enviado à Clicksign. */
export function isSignatureNotSent(c: Pick<Contract, 'status' | 'clicksign_envelope_id'>): boolean {
  return c.status === 'aguardando_assinatura' && !c.clicksign_envelope_id;
}

/** Envelope na Clicksign aguardando assinaturas. */
export function isAwaitingSignatures(c: Pick<Contract, 'status' | 'clicksign_envelope_id'>): boolean {
  return c.status === 'aguardando_assinatura' && !!c.clicksign_envelope_id;
}

export function hasPendingSignatures(c: Contract): boolean {
  if (!isAwaitingSignatures(c)) return false;
  const total = c.clicksign_total_count ?? 4;
  const signed = c.clicksign_signed_count ?? 0;
  return signed < total;
}

const BASE_STATUS_LABEL: Record<Contract['status'], string> = {
  rascunho: 'Rascunho',
  aguardando_assinatura: 'Aguardando assinatura',
  ativo: 'Ativo',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const BASE_STATUS_TONE: Record<Contract['status'], string> = {
  rascunho: 'bg-slate-100 text-slate-700',
  aguardando_assinatura: 'bg-amber-100 text-amber-800',
  ativo: 'bg-emerald-100 text-emerald-800',
  concluido: 'bg-sky-100 text-sky-800',
  cancelado: 'bg-red-100 text-red-700',
};

export function contractStatusDisplay(c: Contract, short = false): { label: string; tone: string } {
  if (isSignatureNotSent(c)) {
    return {
      label: short ? 'Não enviada' : 'Assinatura não enviada',
      tone: 'bg-slate-100/95 text-slate-700 ring-1 ring-slate-200/90',
    };
  }
  if (isAwaitingSignatures(c) && short) {
    return {
      label: 'Aguard. assinatura',
      tone: BASE_STATUS_TONE.aguardando_assinatura,
    };
  }
  return {
    label: BASE_STATUS_LABEL[c.status],
    tone: BASE_STATUS_TONE[c.status],
  };
}

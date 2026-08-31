import type { Contract } from '../services/apiService';

/** Contrato criado ou com envio cancelado — ainda sem envelope na Clicksign. */
export function isSignatureNotSent(c: Pick<Contract, 'status' | 'clicksign_envelope_id'>): boolean {
  if (c.clicksign_envelope_id) return false;
  return c.status === 'pendente_envio' || c.status === 'aguardando_assinatura' || c.status === 'rascunho';
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

/** Filtro "assinaturas pendentes": falta enviar ou falta assinar. */
export function isSignaturePending(c: Pick<Contract, 'status' | 'clicksign_envelope_id'>): boolean {
  return isSignatureNotSent(c) || isAwaitingSignatures(c);
}

const BASE_STATUS_LABEL: Record<Contract['status'], string> = {
  rascunho: 'Rascunho',
  pendente_envio: 'Pendente envio',
  aguardando_assinatura: 'Aguardando assinatura',
  ativo: 'Ativo',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const BASE_STATUS_TONE: Record<Contract['status'], string> = {
  rascunho: 'bg-slate-100 text-slate-700',
  pendente_envio: 'bg-slate-100/95 text-slate-700 ring-1 ring-slate-200/90',
  aguardando_assinatura: 'bg-amber-100 text-amber-800',
  ativo: 'bg-emerald-100 text-emerald-800',
  concluido: 'bg-sky-100 text-sky-800',
  cancelado: 'bg-red-100 text-red-700',
};

export function contractStatusDisplay(c: Contract, short = false): { label: string; tone: string } {
  const total = c.clicksign_total_count ?? 0;
  const signed = c.clicksign_signed_count ?? 0;
  const signaturesComplete =
    c.clicksign_status === 'closed' || (total > 0 && signed >= total);

  if (signaturesComplete && c.status === 'aguardando_assinatura') {
    return {
      label: BASE_STATUS_LABEL.ativo,
      tone: BASE_STATUS_TONE.ativo,
    };
  }

  if (c.status === 'pendente_envio' || isSignatureNotSent(c)) {
    return {
      label: short ? 'Pendente envio' : BASE_STATUS_LABEL.pendente_envio,
      tone: BASE_STATUS_TONE.pendente_envio,
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

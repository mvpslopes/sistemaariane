export const BREEDING_METHODS = [
  { value: 'ia' as const, label: 'Inseminação artificial' },
  { value: 'monta_natural' as const, label: 'Monta natural' },
  { value: 'te' as const, label: 'Transferência de embrião' },
];

export const ABCCMM_STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  comunicado: 'Comunicado',
  confirmado: 'Confirmado',
};

export function breedingMethodLabel(v: string) {
  return BREEDING_METHODS.find((m) => m.value === v)?.label ?? v;
}

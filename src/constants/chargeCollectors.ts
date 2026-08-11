export type ChargeCollector = 'assessoria' | 'seller';

export const CHARGE_COLLECTOR_LABELS: Record<ChargeCollector, string> = {
  assessoria: 'Assessoria / intermediadora',
  seller: 'Vendedor',
};

export const CHARGE_COLLECTOR_SHORT: Record<ChargeCollector, string> = {
  assessoria: 'Assessoria',
  seller: 'Vendedor',
};

export function isChargeCollector(value: unknown): value is ChargeCollector {
  return value === 'assessoria' || value === 'seller';
}

export const VET_TYPES = [
  { value: 'vacina', label: 'Vacina' },
  { value: 'vermifugo', label: 'Vermífugo' },
  { value: 'exame', label: 'Exame' },
  { value: 'tratamento', label: 'Tratamento' },
  { value: 'outro', label: 'Outro' },
] as const;

export type VetRecordType = (typeof VET_TYPES)[number]['value'];

export const STOCK_CATEGORIES = [
  { value: 'medicamento', label: 'Medicamento' },
  { value: 'insumo', label: 'Insumo' },
  { value: 'racao', label: 'Ração' },
  { value: 'material', label: 'Material' },
  { value: 'outro', label: 'Outro' },
] as const;

export type StockCategory = (typeof STOCK_CATEGORIES)[number]['value'];

export const STOCK_UNITS = ['un', 'kg', 'l', 'cx', 'dose', 'fardo'] as const;

export const FINANCE_INCOME_CATEGORIES = [
  { value: 'diarias', label: 'Diárias de hospedagem' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'venda_insumo', label: 'Venda de insumo' },
  { value: 'outros', label: 'Outros' },
] as const;

export const FINANCE_EXPENSE_CATEGORIES = [
  { value: 'racao', label: 'Ração' },
  { value: 'veterinario', label: 'Veterinário' },
  { value: 'medicamentos', label: 'Medicamentos' },
  { value: 'mao_obra', label: 'Mão de obra' },
  { value: 'energia', label: 'Energia / água' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'outros', label: 'Outros' },
] as const;

export function vetTypeLabel(v: string) {
  return VET_TYPES.find((t) => t.value === v)?.label ?? v;
}

export function stockCategoryLabel(v: string) {
  return STOCK_CATEGORIES.find((t) => t.value === v)?.label ?? v;
}

export function financeCategoryLabel(type: string, category: string) {
  const list = type === 'receita' ? FINANCE_INCOME_CATEGORIES : FINANCE_EXPENSE_CATEGORIES;
  return list.find((c) => c.value === category)?.label ?? category;
}

export function moneyBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function stayDays(checkIn: string, checkOut?: string | null) {
  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${(checkOut || new Date().toISOString().slice(0, 10))}T12:00:00`);
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return Math.max(1, diff || 1);
}

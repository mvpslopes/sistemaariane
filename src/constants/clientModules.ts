import type { ClientModuleCode } from '../services/apiService';

export type { ClientModuleCode };

export const CLIENT_MODULES: { code: ClientModuleCode; label: string; description: string }[] = [
  { code: 'plantel', label: 'Plantel básico', description: 'Animais, fotos e proprietários' },
  { code: 'reproducao', label: 'Reprodução', description: 'Cobrições, embriões, prenhez e nascimentos' },
  { code: 'sanitario', label: 'Sanitário', description: 'Vacinas, vermífugos e exames' },
  { code: 'estoque', label: 'Estoque do haras', description: 'Medicamentos, ração, insumos e movimentações' },
  { code: 'hospedagem', label: 'Hospedagem', description: 'Baias, diárias e ocupação' },
  { code: 'financeiro_haras', label: 'Financeiro do haras', description: 'Receitas e despesas da propriedade' },
  { code: 'contratos', label: 'Contratos e cobranças', description: 'Vendas, parcelas e boletos' },
  { code: 'leiloes', label: 'Leilões', description: 'Eventos, lotes e financeiro por leilão' },
];

export const HARAS_CLIENT_MODULE_LINKS: {
  code: ClientModuleCode;
  to: string;
  label: string;
}[] = [
  { code: 'sanitario', to: '/app/haras/veterinario', label: 'Controle veterinário' },
  { code: 'estoque', to: '/app/haras/estoque', label: 'Controle de estoque' },
  { code: 'hospedagem', to: '/app/haras/hospedagem', label: 'Controle de hospedagem' },
  { code: 'financeiro_haras', to: '/app/haras/financeiro', label: 'Controle financeiro' },
];

export function clientModuleLabel(code: string) {
  return CLIENT_MODULES.find((m) => m.code === code)?.label ?? code;
}

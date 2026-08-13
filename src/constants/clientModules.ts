export type ClientModuleCode = 'plantel' | 'reproducao' | 'sanitario' | 'contratos' | 'leiloes';

export const CLIENT_MODULES: { code: ClientModuleCode; label: string; description: string }[] = [
  { code: 'plantel', label: 'Plantel básico', description: 'Animais, fotos e proprietários' },
  { code: 'reproducao', label: 'Reprodução', description: 'Cobrições, embriões, prenhez e nascimentos' },
  { code: 'sanitario', label: 'Sanitário', description: 'Vacinas, vermífugos e exames' },
  { code: 'contratos', label: 'Contratos e cobranças', description: 'Vendas, parcelas e boletos' },
  { code: 'leiloes', label: 'Leilões', description: 'Eventos, lotes e financeiro por leilão' },
];

export function clientModuleLabel(code: string) {
  return CLIENT_MODULES.find((m) => m.code === code)?.label ?? code;
}

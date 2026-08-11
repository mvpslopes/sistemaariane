/** Rótulos do portal quando o usuário logado é cliente (comprador/vendedor etc.). */
export const clientPortalLabels = {
  animalsNav: 'Minhas compras',
  animalsPageSubtitle: 'Animais, cotas e coberturas dos seus contratos',
  dashboardSubtitle: 'Visão geral das suas compras, contratos e cobranças',
  purchasesLinked: 'Compras vinculadas',
  purchasesActive: 'Compras ativas',
  sectionOperation: 'Suas compras e contratos',
  viewPurchases: 'Ver minhas compras',
  summaryPurchases: 'Acompanhe suas compras, contratos e cobranças vinculadas.',
  loadingPurchases: 'Carregando suas compras...',
  loadError: 'Erro ao carregar compras',
  emptyPurchases: 'Nenhuma compra encontrada',
  emptyPurchasesHint: 'Quando houver contratos vinculados a você, aparecerão aqui.',
  searchPlaceholder: 'Buscar por nome, registro ou chip...',
  countPurchases: 'compras',
  countActive: 'ativas',
  chartByStatus: 'Compras por status',
  chartBySex: 'Compras por sexo',
  chartByAssociation: 'Compras por associação',
  tableAnimal: 'Animal / item',
} as const;

export function resolvePageMeta(pathname: string, isCliente: boolean) {
  const defaults: Record<string, { title: string; subtitle: string }> = {
    '/app': {
      title: 'Dashboard',
      subtitle: isCliente
        ? clientPortalLabels.dashboardSubtitle
        : 'Visão geral do plantel e cadastros',
    },
    '/app/pessoas': {
      title: 'Pessoas',
      subtitle: 'Compradores, vendedores, assessores, testemunhas e avalistas em um só cadastro',
    },
    '/app/animais': {
      title: isCliente ? clientPortalLabels.animalsNav : 'Animais',
      subtitle: isCliente
        ? clientPortalLabels.animalsPageSubtitle
        : 'Plantel e documentação básica',
    },
    '/app/leiloes': {
      title: 'Leilões',
      subtitle: 'Eventos, lotes e registro de arremates',
    },
    '/app/contratos': { title: 'Contratos', subtitle: 'Vendas e aceites digitais' },
    '/app/modelos-contrato': {
      title: 'Modelos de contrato',
      subtitle: 'Versos (cláusulas) reutilizáveis na nota de leilão',
    },
    '/app/cobrancas': { title: 'Cobranças', subtitle: 'Parcelas, PIX e boletos' },
    '/app/repasses': {
      title: 'Repasses',
      subtitle: 'Assessoria, dono do animal e assessores por parcela',
    },
    '/app/perfil': { title: 'Meu perfil', subtitle: 'Dados de exibição da conta' },
    '/app/usuarios': { title: 'Usuários', subtitle: 'Acessos ao sistema' },
    '/app/alterar-senha': { title: 'Alterar senha', subtitle: 'Segurança da sua conta' },
  };

  return defaults[pathname] || defaults['/app'];
}

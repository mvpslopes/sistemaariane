import { assessorPortalLabels } from './assessorPortalLabels';

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

export function resolvePageMeta(pathname: string, isCliente: boolean, isAssessor = false) {
  if (pathname.startsWith('/app/animais/') && pathname !== '/app/animais') {
    return { title: 'Ficha do animal', subtitle: 'Dados, proprietários e contratos vinculados' };
  }
  const defaults: Record<string, { title: string; subtitle: string }> = {
    '/app': {
      title: 'Dashboard',
      subtitle: isAssessor
        ? assessorPortalLabels.dashboardSubtitle
        : isCliente
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
    '/app/reproducao': {
      title: 'Reprodução',
      subtitle: 'Cobrições, estações e status ABCCMM (manual)',
    },
    '/app/leiloes': {
      title: 'Leilões',
      subtitle: isAssessor
        ? assessorPortalLabels.eventsPageSubtitle
        : 'Eventos, lotes e registro de arremates',
    },
    '/app/eventos': {
      title: 'Leilões',
      subtitle: 'Eventos, lotes e registro de arremates',
    },
    '/app/contratos': { title: 'Contratos', subtitle: 'Vendas e aceites digitais' },
    '/app/modelos-contrato': {
      title: 'Modelos de contrato',
      subtitle: 'Versos (cláusulas) reutilizáveis na nota de leilão',
    },
    '/app/registro-diario': {
      title: 'Registro diário',
      subtitle: 'Atendimento da equipe ao final do expediente',
    },
    '/app/registro-diario/novo': {
      title: 'Novo registro diário',
      subtitle: 'Preenchimento do atendimento de hoje',
    },
    '/app/cobrancas': { title: 'Cobranças', subtitle: 'Parcelas, PIX e boletos' },
    '/app/recebiveis': {
      title: 'Recebíveis',
      subtitle: 'Inadimplência, envelhecimento e alertas',
    },
    '/app/financeiro-empresa': {
      title: 'Financeiro da empresa',
      subtitle: 'Consolidado assessoria, leilões e SaaS',
    },
    '/app/assinaturas': {
      title: 'Assinaturas SaaS',
      subtitle: 'Planos, módulos e mensalidade por haras',
    },
    '/app/repasses': {
      title: 'Repasses',
      subtitle: 'Assessoria, dono do animal e assessores por parcela',
    },
    '/app/perfil': { title: 'Meu perfil', subtitle: 'Dados de exibição da conta' },
    '/app/ajuda': {
      title: 'Central de ajuda',
      subtitle: 'Guias de cadastro, consulta e fluxos do sistema',
    },
    '/app/usuarios': { title: 'Usuários', subtitle: 'Acessos ao sistema' },
    '/app/auditoria': { title: 'Auditoria', subtitle: 'Registro de ações no sistema' },
    '/app/alterar-senha': { title: 'Alterar senha', subtitle: 'Segurança da sua conta' },
  };

  return defaults[pathname] || defaults['/app'];
}

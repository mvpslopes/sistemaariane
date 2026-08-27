export type HelpCategory = 'cadastro' | 'visualizacao';

export type HelpAudience = 'all' | 'staff' | 'cliente' | 'assessor';

export interface HelpArticle {
  id: string;
  category: HelpCategory;
  audience: HelpAudience[];
  title: string;
  summary: string;
  steps: string[];
  tip?: string;
  to?: string;
  toLabel?: string;
}

export const HELP_CATEGORY_LABELS: Record<HelpCategory, string> = {
  cadastro: 'Cadastros',
  visualizacao: 'Visualização e consultas',
};

export const HELP_ARTICLES: HelpArticle[] = [
  // ——— Staff: cadastros ———
  {
    id: 'cadastro-pessoa',
    category: 'cadastro',
    audience: ['staff'],
    title: 'Cadastrar uma pessoa',
    summary: 'Compradores, vendedores, assessores, testemunhas e avalistas ficam no mesmo cadastro.',
    steps: [
      'Menu Cadastros → Pessoas → botão nova pessoa.',
      'Preencha nome, documento e contato (WhatsApp ajuda nas cobranças).',
      'Marque os papéis: comprador, vendedor, assessor, testemunha ou avalista.',
      'Salve. A mesma pessoa pode ter mais de um papel.',
    ],
    tip: 'Antes de criar, busque pelo CPF/CNPJ — evita duplicidade.',
    to: '/app/pessoas',
    toLabel: 'Ir para Pessoas',
  },
  {
    id: 'cadastro-animal',
    category: 'cadastro',
    audience: ['staff'],
    title: 'Cadastrar um animal',
    summary: 'Registro do plantel com sexo, raça, associação e status.',
    steps: [
      'Cadastros → Animais → novo animal.',
      'Informe nome, sexo, raça e associação (ABCCMM, ABQM etc.).',
      'Defina o status (ativo, vendido, transferido…).',
      'Opcional: foto, chip e data de nascimento.',
    ],
    tip: 'Animais vendidos continuam no histórico — altere o status em vez de excluir.',
    to: '/app/animais',
    toLabel: 'Ir para Animais',
  },
  {
    id: 'cadastro-contrato',
    category: 'cadastro',
    audience: ['staff'],
    title: 'Criar um contrato de venda',
    summary: 'Vincula vendedor, comprador, animal e condições de pagamento.',
    steps: [
      'Operação → Contratos → novo contrato.',
      'Selecione vendedor, comprador e animal.',
      'Defina valor, parcelas e datas de vencimento.',
      'Gere o PDF e envie para assinatura digital (Clicksign) quando estiver pronto.',
    ],
    tip: 'Testemunhas e avalistas podem ser exigidos conforme o modelo do contrato.',
    to: '/app/contratos',
    toLabel: 'Ir para Contratos',
  },
  {
    id: 'cadastro-cobranca',
    category: 'cadastro',
    audience: ['staff'],
    title: 'Registrar pagamento de parcela',
    summary: 'Atualize cobranças quando o comprador pagar; use filtros e ações em lote.',
    steps: [
      'Financeiro → Cobranças.',
      'No topo, veja o resumo: total de parcelas, em aberto, pagas e atrasadas.',
      'Filtre por cliente no dropdown para ver só as parcelas de uma pessoa.',
      'Abra o detalhe e use Pagar para registrar pagamento, com data e forma.',
      'Para passar várias parcelas de um cliente ao vendedor de uma vez, use Passar todas para o vendedor.',
    ],
    tip: 'Parcelas atrasadas aparecem no sininho, em Recebíveis e no Relatório de cobrança.',
    to: '/app/cobrancas',
    toLabel: 'Ir para Cobranças',
  },
  {
    id: 'cadastro-cobertura',
    category: 'cadastro',
    audience: ['staff'],
    title: 'Registrar cobertura (reprodução)',
    summary: 'Controle manual de cobrições e status ABCCMM.',
    steps: [
      'Cadastros → Reprodução → nova cobertura.',
      'Informe égua, garanhão, data e método.',
      'Atualize o status ABCCMM: pendente → comunicado → confirmado.',
    ],
    tip: 'A integração oficial com ABCCMM será em fase futura; hoje o registro é manual.',
    to: '/app/reproducao',
    toLabel: 'Ir para Reprodução',
  },
  {
    id: 'cadastro-haras-vet',
    category: 'cadastro',
    audience: ['staff'],
    title: 'Controle veterinário do haras',
    summary: 'Vacinas, vermífugos, exames e tratamentos do plantel.',
    steps: [
      'Haras → Controle veterinário → novo registro. Selecione o haras da pessoa (Pessoas → Propriedades).',
      'Escolha o animal, o tipo e a data do procedimento.',
      'Informe a próxima dose para gerar alerta de atraso.',
    ],
    tip: 'O histórico também aparece na ficha do animal.',
    to: '/app/haras/veterinario',
    toLabel: 'Ir para Veterinário',
  },
  {
    id: 'cadastro-haras-estoque',
    category: 'cadastro',
    audience: ['staff'],
    title: 'Estoque do haras',
    summary: 'Medicamentos, ração, insumos e movimentação de saldo.',
    steps: [
      'Haras → Controle de estoque → novo item (saldo inicial só no cadastro).',
      'Use Movimentar para entrada, saída ou ajuste — o cadastro não altera quantidade depois.',
      'Itens abaixo do mínimo aparecem em destaque no painel.',
    ],
    tip: 'Na saída, dá para vincular o animal que consumiu o produto.',
    to: '/app/haras/estoque',
    toLabel: 'Ir para Estoque',
  },
  {
    id: 'cadastro-haras-hospedagem',
    category: 'cadastro',
    audience: ['staff'],
    title: 'Hospedagem e diárias',
    summary: 'Baias ocupadas, check-in/out e estimativa do período.',
    steps: [
      'Haras → Controle de hospedagem → nova hospedagem.',
      'Informe animal, baia, diária e data de entrada.',
      'Ao encerrar, a data de saída é registrada. Se houver diária, a receita vai ao financeiro do haras.',
    ],
    tip: 'Um animal não pode ter duas hospedagens abertas ao mesmo tempo.',
    to: '/app/haras/hospedagem',
    toLabel: 'Ir para Hospedagem',
  },
  {
    id: 'cadastro-haras-financeiro',
    category: 'cadastro',
    audience: ['staff'],
    title: 'Financeiro da propriedade',
    summary: 'Receitas e despesas do haras, separado da assessoria e dos leilões.',
    steps: [
      'Haras → Financeiro do haras.',
      'Lance receitas (diárias, serviços) ou despesas (ração, veterinário, manutenção).',
      'Filtre por período e tipo para ver o saldo da propriedade.',
    ],
    tip: 'Diárias de hospedagem encerrada entram automaticamente como receita.',
    to: '/app/haras/financeiro',
    toLabel: 'Ir para Financeiro do haras',
  },
  {
    id: 'cadastro-leilao',
    category: 'cadastro',
    audience: ['staff'],
    title: 'Criar leilão e lotes',
    summary: 'Eventos com lotes, arremates e financeiro do evento.',
    steps: [
      'Operação → Leilões → novo evento.',
      'Cadastre lotes vinculando animais ou descrições.',
      'Registre arremates e acompanhe a aba financeira do evento.',
    ],
    to: '/app/leiloes',
    toLabel: 'Ir para Leilões',
  },

  {
    id: 'cadastro-registro-diario',
    category: 'cadastro',
    audience: ['staff'],
    title: 'Registro diário de atendimento',
    summary: 'Formulário obrigatório ao final do expediente para operadores.',
    steps: [
      'Operação → Registro diário → Novo registro.',
      'Informe faixa de atendimentos, pendências e autoavaliação.',
      'Confirme a declaração e salve — apenas um registro por dia.',
    ],
    to: '/app/registro-diario',
    toLabel: 'Ir para Registro diário',
  },

  // ——— Staff: visualização ———
  {
    id: 'vis-dashboard',
    category: 'visualizacao',
    audience: ['staff'],
    title: 'Entender a dashboard',
    summary: 'Visão rápida de assessoria, leilões, recebíveis e financeiro.',
    steps: [
      'Os 4 blocos superiores resumem cada área do negócio.',
      '“Precisa de atenção” lista alertas operacionais (também no sininho).',
      'Gráficos mostram distribuição de animais, contratos e cobranças.',
      'Atividade recente traz os últimos cadastros.',
    ],
    to: '/app',
    toLabel: 'Ir para Dashboard',
  },
  {
    id: 'vis-ficha-animal',
    category: 'visualizacao',
    audience: ['staff', 'cliente'],
    title: 'Ficha do animal',
    summary: 'Detalhes, foto, proprietários e contratos vinculados.',
    steps: [
      'Em Animais (ou Minhas compras), clique no nome do animal.',
      'Veja dados cadastrais, status e associação.',
      'Role para contratos e cobranças ligados ao animal.',
    ],
    to: '/app/animais',
    toLabel: 'Ver animais',
  },
  {
    id: 'vis-relatorio-plantel',
    category: 'visualizacao',
    audience: ['staff', 'cliente'],
    title: 'Relatório do plantel',
    summary: 'Lista filtrável com nascimento, idade, pelagem, pai, mãe e exportação PDF/Excel.',
    steps: [
      'Assessoria → Relatório do plantel (ou o botão Relatório em Animais).',
      'Filtre por status, sexo, raça, proprietário, período de nascimento, pai ou mãe.',
      'Exporte PDF ou Excel com o recorte atual.',
    ],
    tip: 'O filtro Plantel ativo equivale a excluir vendidos, falecidos e transferidos.',
    to: '/app/relatorio-plantel',
    toLabel: 'Ir para o relatório',
  },
  {
    id: 'vis-recebiveis',
    category: 'visualizacao',
    audience: ['staff'],
    title: 'Recebíveis e inadimplência',
    summary: 'Aging, devedores e cobrança via WhatsApp.',
    steps: [
      'Financeiro → Recebíveis.',
      'Gráfico de envelhecimento mostra valores por faixa de atraso.',
      'Lista de devedores permite contato via WhatsApp com mensagem personalizável.',
      'Exporte PDF para relatório ou reunião.',
    ],
    tip: 'Para visão analítica parcela a parcela, use Relatório de cobrança.',
    to: '/app/recebiveis',
    toLabel: 'Ir para Recebíveis',
  },
  {
    id: 'vis-relatorio-cobranca',
    category: 'visualizacao',
    audience: ['staff'],
    title: 'Relatório de cobrança',
    summary: 'Visão analítica de parcelas com filtros, cobrança e histórico.',
    steps: [
      'Financeiro → Relatório de cobrança.',
      'Filtre por palavra-chave, cliente, situação (vencidos, a vencer, pagos, cancelados) e datas.',
      'Use Cobrar para abrir WhatsApp com mensagem de cobrança.',
      'Use Histórico para registrar e consultar tentativas de cobrança de cada parcela.',
    ],
    to: '/app/relatorio-cobranca',
    toLabel: 'Ir para Relatório de cobrança',
  },
  {
    id: 'vis-mensagens',
    category: 'visualizacao',
    audience: ['all'],
    title: 'Mensagens internas',
    summary: 'Chat entre membros da equipe e clientes com a assessoria.',
    steps: [
      'Menu lateral → Mensagens (ícone de conversa).',
      'Inicie nova conversa buscando por nome ou usuário.',
      'Novas mensagens aparecem em toast no topo (mobile) e atualizam o contador.',
      'Suas mensagens mostram ✓ quando enviadas e Visto às HH:MM quando o contato abriu a conversa.',
    ],
    tip: 'Clientes só podem conversar com a equipe (admin, operadores).',
    to: '/app/mensagens',
    toLabel: 'Ir para Mensagens',
  },
  {
    id: 'vis-notificacoes',
    category: 'visualizacao',
    audience: ['all'],
    title: 'Sininho de avisos',
    summary: 'Alertas importantes no topo da tela.',
    steps: [
      'Clique no ícone de sino no header.',
      'Avisos não lidos aparecem com indicador; clique para ir à tela relacionada.',
      'Use “Marcar lidas” quando já tiver tratado.',
      'Se a situação mudar (ex.: mais cobranças atrasadas), o aviso volta.',
    ],
  },
  {
    id: 'vis-financeiro-empresa',
    category: 'visualizacao',
    audience: ['staff'],
    title: 'Financeiro da empresa',
    summary: 'Consolidado de assessoria, leilões e SaaS.',
    steps: [
      'Financeiro → Financeiro empresa.',
      'Compare receitas por área e repasses pendentes.',
      'Use como visão gerencial mensal.',
    ],
    to: '/app/financeiro-empresa',
    toLabel: 'Ir para Financeiro',
  },

  // ——— Cliente ———
  {
    id: 'cliente-compras',
    category: 'visualizacao',
    audience: ['cliente'],
    title: 'Minhas compras',
    summary: 'Animais e itens vinculados aos seus contratos.',
    steps: [
      'Menu Minhas compras (Animais).',
      'Lista só o que está ligado à sua conta de cliente.',
      'Clique em um item para ver a ficha completa.',
    ],
    to: '/app/animais',
    toLabel: 'Ver minhas compras',
  },
  {
    id: 'cliente-contratos',
    category: 'visualizacao',
    audience: ['cliente'],
    title: 'Meus contratos',
    summary: 'Acompanhe vendas em que você é comprador ou vendedor.',
    steps: [
      'Operação → Contratos.',
      'Veja status: rascunho, aguardando assinatura, ativo ou concluído.',
      'Contratos aguardando assinatura precisam do link Clicksign enviado por e-mail/WhatsApp.',
    ],
    to: '/app/contratos',
    toLabel: 'Ver contratos',
  },
  {
    id: 'cliente-cobrancas',
    category: 'visualizacao',
    audience: ['cliente'],
    title: 'Minhas cobranças',
    summary: 'Parcelas pendentes, pagas e atrasadas.',
    steps: [
      'Operação → Cobranças.',
      'Filtre por status para ver o que falta pagar.',
      'Em caso de dúvida sobre boleto ou PIX, contate a assessoria.',
    ],
    to: '/app/cobrancas',
    toLabel: 'Ver cobranças',
  },
  {
    id: 'cliente-modulos',
    category: 'visualizacao',
    audience: ['cliente'],
    title: 'Módulos do meu haras',
    summary: 'O que está ativo no seu plano SaaS.',
    steps: [
      'Na dashboard, veja o painel “Seu plano · módulos do haras”.',
      'Itens com ✓ estão liberados; riscados ainda não fazem parte do plano.',
      'Alterações são feitas pela assessoria em Assinaturas.',
    ],
    to: '/app',
    toLabel: 'Ir para Dashboard',
  },

  // ——— Assessor ———
  {
    id: 'assessor-leiloes',
    category: 'visualizacao',
    audience: ['assessor'],
    title: 'Leilões como assessor',
    summary: 'Eventos e lotes sob sua responsabilidade.',
    steps: [
      'Menu Assessoria → Leilões.',
      'Consulte eventos abertos e lotes.',
      'Acompanhe arremates e repasses relacionados.',
    ],
    to: '/app/leiloes',
    toLabel: 'Ir para Leilões',
  },
  {
    id: 'assessor-repasses',
    category: 'visualizacao',
    audience: ['assessor'],
    title: 'Meus repasses',
    summary: 'Valores a receber por parcelas quitadas.',
    steps: [
      'Assessoria → Repasses.',
      'Status pendente = aguardando liberação; pago = já transferido.',
      'Dúvidas sobre valores: contate a assessoria principal.',
    ],
    to: '/app/repasses',
    toLabel: 'Ir para Repasses',
  },
];

export interface HelpViewerContext {
  isCliente: boolean;
  isAssessor: boolean;
}

export function filterHelpArticles(
  articles: HelpArticle[],
  ctx: HelpViewerContext
): HelpArticle[] {
  const { isCliente, isAssessor } = ctx;

  return articles.filter((a) => {
    if (a.audience.includes('all')) return true;
    if (isAssessor && a.audience.includes('assessor')) return true;
    if (isCliente && !isAssessor && a.audience.includes('cliente')) return true;
    if (!isCliente && a.audience.includes('staff')) return true;
    return false;
  });
}

export function groupHelpByCategory(articles: HelpArticle[]) {
  const cadastro = articles.filter((a) => a.category === 'cadastro');
  const visualizacao = articles.filter((a) => a.category === 'visualizacao');
  return { cadastro, visualizacao };
}

export function findHelpArticle(id: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.id === id);
}

import {
  filterHelpArticles,
  HELP_ARTICLES,
  type HelpViewerContext,
} from '../constants/helpArticles';

export function buildAssistantKnowledge(ctx: HelpViewerContext): string {
  const articles = filterHelpArticles(HELP_ARTICLES, ctx);
  const lines = articles.map((a) => {
    const steps = a.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n');
    const link = a.to ? `\n  Link no sistema: ${a.to}${a.toLabel ? ` (${a.toLabel})` : ''}` : '';
    const tip = a.tip ? `\n  Dica: ${a.tip}` : '';
    return `### ${a.title}\n${a.summary}\n${steps}${tip}${link}`;
  });

  return [
    'Base de conhecimento do Gestão de Haras (use apenas isto para orientar o usuário):',
    '',
    ...lines,
    '',
    'Rotas úteis: /app (dashboard), /app/pessoas, /app/animais, /app/contratos, /app/cobrancas,',
    '/app/recebiveis, /app/relatorio-cobranca, /app/mensagens, /app/leiloes, /app/reproducao,',
    '/app/registro-diario, /app/repasses, /app/perfil',
  ].join('\n');
}

export function suggestedAssistantPrompts(ctx: HelpViewerContext): string[] {
  if (ctx.isAssessor) {
    return [
      'Como vejo meus repasses?',
      'Onde ficam os leilões?',
      'Como acompanho contratos?',
    ];
  }
  if (ctx.isCliente) {
    return [
      'Onde vejo minhas compras?',
      'Como consulto minhas cobranças?',
      'O que significa aguardando assinatura?',
    ];
  }
  return [
    'Como cadastro um animal?',
    'Onde fica o relatório de cobrança?',
    'Como enviar contrato para assinatura?',
    'Como usar as mensagens internas?',
  ];
}

import { formatDateBR } from './dateTime';

const STORAGE_KEY = 'ariane.receivablesWhatsappTemplate';

export const RECEIVABLES_WHATSAPP_PLACEHOLDERS = [
  { key: '{nome}', hint: 'Primeiro nome do cliente' },
  { key: '{nome_completo}', hint: 'Nome completo' },
  { key: '{valor}', hint: 'Valor em atraso' },
  { key: '{parcelas}', hint: 'Quantidade de parcelas' },
  { key: '{vencimento}', hint: 'Data da parcela mais antiga' },
  { key: '{vencimento_linha}', hint: 'Frase com a data (ou vazio)' },
  { key: '{animal}', hint: 'Nome do animal (quando houver)' },
  { key: '{animal_linha}', hint: 'Frase com o animal (ou vazio)' },
  { key: '{contrato}', hint: 'Número do contrato (quando houver)' },
  { key: '{compra_linha}', hint: 'Frase com contrato e animal (ou vazio)' },
  { key: '{dados_bancarios}', hint: 'Texto dos dados bancários cadastrados' },
  { key: '{dados_bancarios_linha}', hint: 'Bloco formatado com dados bancários (ou vazio)' },
] as const;

export const DEFAULT_COLLECTION_BANK_DETAILS = '';

export const DEFAULT_RECEIVABLES_WHATSAPP_TEMPLATE = `Olá {nome}, tudo bem?

Identificamos {parcelas} parcela(s) em atraso, totalizando {valor}.{vencimento_linha}{compra_linha}
{dados_bancarios_linha}
Podemos conversar para regularizar?

Atenciosamente,
Ariane Andrade Assessoria`;

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return 'cliente';
  return trimmed.split(/\s+/)[0] || trimmed;
}

export type ReceivablesWhatsAppContext = {
  clientName: string;
  overdueAmount: number;
  chargesCount: number;
  oldestDue?: string | null;
  animalName?: string | null;
  contractNumber?: string | null;
  bankDetails?: string | null;
};

export function loadReceivablesWhatsappTemplate(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved?.trim()) return saved;
  } catch {
    /* ignore */
  }
  return DEFAULT_RECEIVABLES_WHATSAPP_TEMPLATE;
}

export function saveReceivablesWhatsappTemplate(template: string): void {
  localStorage.setItem(STORAGE_KEY, template);
}

function buildCompraLinha(ctx: ReceivablesWhatsAppContext): string {
  const animal = ctx.animalName?.trim();
  const contrato = ctx.contractNumber?.trim();
  if (animal && contrato) {
    return `\nReferente ao contrato ${contrato} · animal ${animal}.`;
  }
  if (contrato) return `\nReferente ao contrato ${contrato}.`;
  if (animal) return `\nReferente ao animal ${animal}.`;
  return '';
}

function buildBankDetailsLinha(bankDetails?: string | null): string {
  const text = bankDetails?.trim();
  if (!text) return '';
  return `\n\nPara pagamento:\n${text}`;
}

export function applyReceivablesWhatsappTemplate(
  template: string,
  ctx: ReceivablesWhatsAppContext
): string {
  const vencimentoLinha = ctx.oldestDue
    ? `\nA parcela mais antiga venceu em ${formatDateBR(ctx.oldestDue)}.`
    : '';
  const animalLinha = ctx.animalName?.trim() ? `\nReferente ao animal ${ctx.animalName.trim()}.` : '';
  const compraLinha = buildCompraLinha(ctx);
  const bankText = ctx.bankDetails?.trim() || '';
  const bankLinha = buildBankDetailsLinha(bankText);

  return template
    .replace(/\{nome\}/g, firstName(ctx.clientName))
    .replace(/\{nome_completo\}/g, ctx.clientName.trim() || 'cliente')
    .replace(/\{valor\}/g, money(ctx.overdueAmount))
    .replace(/\{parcelas\}/g, String(ctx.chargesCount))
    .replace(/\{vencimento\}/g, ctx.oldestDue ? formatDateBR(ctx.oldestDue) : '—')
    .replace(/\{vencimento_linha\}/g, vencimentoLinha)
    .replace(/\{animal\}/g, ctx.animalName?.trim() || '')
    .replace(/\{animal_linha\}/g, animalLinha)
    .replace(/\{contrato\}/g, ctx.contractNumber?.trim() || '')
    .replace(/\{compra_linha\}/g, compraLinha)
    .replace(/\{dados_bancarios\}/g, bankText)
    .replace(/\{dados_bancarios_linha\}/g, bankLinha);
}

export function whatsAppHref(phone: string | null | undefined, message: string): string | null {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const n = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

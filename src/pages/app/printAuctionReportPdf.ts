import type { AuctionFinance, AuctionStatus } from '../../services/apiService';
import { auctionExpenseCategoryLabel } from '../../constants/auctionFinance';
import { formatDateBR, formatDateTimeBR } from '../../utils/dateTime';

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ASSESSORIA = {
  name: 'ARIANE ANDRADE INTELIGÊNCIA AGROPECUÁRIA LTDA.',
  cnpj: '43.507.435/0001-30',
  email: 'contato@arianeandradeassessoria.app.br',
  cityUf: 'Rio de Janeiro / RJ',
};

function esc(s: string | null | undefined) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const contractStatusLabel: Record<string, string> = {
  rascunho: 'Rascunho',
  aguardando_assinatura: 'Aguardando assinatura',
  ativo: 'Ativo',
  concluido: 'Concluído',
};

const auctionStatusLabel: Record<AuctionStatus, string> = {
  rascunho: 'Rascunho',
  agendado: 'Agendado',
  em_andamento: 'Em andamento',
  encerrado: 'Encerrado',
  cancelado: 'Cancelado',
};

export interface AuctionReportMeta {
  name: string;
  auctionDate?: string | null;
  location?: string | null;
  status?: AuctionStatus;
}

/** Estilos alinhados ao PDF de contrato (printContractPdf.ts). */
const REPORT_STYLES = `
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    color: #222; font-size: 9.5pt; line-height: 1.35;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page { page-break-after: auto; }
  table.head { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  table.head td { vertical-align: top; }
  .head-left { width: auto; padding-right: 12px; }
  .logo { height: 42px; width: auto; display: block; margin-bottom: 6px; }
  .doc-title { font-size: 12pt; font-weight: 800; letter-spacing: 0.02em; margin: 0 0 2px; text-transform: uppercase; }
  .auction { font-size: 10pt; font-weight: 700; margin: 0 0 4px; }
  .company { font-size: 7.5pt; color: #444; line-height: 1.3; }
  .idbox {
    width: 170px; border: 1px solid #999; background: #f0f0f0;
    padding: 8px; text-align: center;
  }
  .idbox .lote { font-size: 14pt; font-weight: 800; margin: 0; line-height: 1.2; }
  .idbox .via { font-size: 7.5pt; margin: 4px 0; line-height: 1.35; font-weight: 700; }
  .idbox .num { font-size: 9pt; font-weight: 700; }
  .idbox .emi { font-size: 7.5pt; color: #555; margin-top: 4px; }
  .section { border: 1px solid #bbb; margin-top: 8px; }
  .section-h {
    background: #d9d9d9; font-weight: 700; font-size: 8.5pt;
    padding: 4px 6px; text-transform: uppercase; letter-spacing: 0.04em;
  }
  table.fields { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  table.fields td { border-top: 1px solid #ddd; padding: 3px 6px; vertical-align: top; }
  table.fields .k { width: 22%; font-weight: 700; color: #444; background: #fafafa; }
  table.data { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  table.data th, table.data td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
  table.data th { background: #eee; font-size: 8pt; font-weight: 700; }
  table.data td.num { text-align: right; white-space: nowrap; }
  table.fin { width: 100%; border-collapse: collapse; font-size: 9pt; }
  table.fin td { padding: 8px 10px; vertical-align: top; border-top: 1px solid #ddd; }
  table.fin strong { font-size: 10pt; }
  .pay-summary { padding: 6px 8px; font-size: 8.5pt; border-top: 1px solid #ddd; color: #444; }
  .empty { padding: 8px 10px; font-size: 8.5pt; color: #666; font-style: italic; }
  .muted { color: #555; font-size: 8pt; }
  .legal {
    margin-top: 10px; font-size: 8pt; font-weight: 700; text-align: center;
  }
  .result-pos { color: #1a5c3a; }
  .result-neg { color: #8b1e1e; }
`;

function buildAuctionReportHtml(meta: AuctionReportMeta, finance: AuctionFinance): string {
  const logoUrl = `${window.location.origin}/logo-ariane-wide-transparente.png`;
  const generatedAt = formatDateTimeBR(new Date());
  const eventDate = formatDateBR(meta.auctionDate) || '—';
  const statusLabel = meta.status ? auctionStatusLabel[meta.status] : '—';
  const auctionLine = `${meta.name}${eventDate !== '—' ? ` — ${eventDate}` : ''}`;

  const contractRows = finance.contracts
    .map(
      (c) => `
          <tr>
            <td>${esc(c.lot_number || '—')}</td>
            <td><strong>${esc(c.animal_name || '—')}</strong></td>
            <td>${esc(c.buyer_name || '—')}</td>
            <td class="num">${esc(money(c.total_amount))}</td>
            <td class="num">${
              c.assessoria_pct > 0
                ? `${esc(money(c.assessoria_amount))} <span class="muted">(${esc(String(c.assessoria_pct))}%)</span>`
                : '—'
            }</td>
            <td>${esc(contractStatusLabel[c.status] || c.status)}</td>
          </tr>`
    )
    .join('');

  const expenseRows = finance.expenses
    .map(
      (e) => `
          <tr>
            <td>${esc(formatDateBR(e.expense_date))}</td>
            <td>${esc(auctionExpenseCategoryLabel(e.category))}</td>
            <td>${esc(e.description || '—')}</td>
            <td class="num">${esc(money(e.amount))}</td>
          </tr>`
    )
    .join('');

  const categoryRows = Object.entries(finance.expenses_by_category || {})
    .map(
      ([cat, total]) => `
          <tr>
            <td>${esc(auctionExpenseCategoryLabel(cat))}</td>
            <td class="num">${esc(money(total))}</td>
          </tr>`
    )
    .join('');

  const resultClass = finance.result_net >= 0 ? 'result-pos' : 'result-neg';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Relatório — ${esc(meta.name)}</title>
  <style>${REPORT_STYLES}</style>
</head>
<body>
  <div class="page">
    <table class="head">
      <tr>
        <td class="head-left">
          <img class="logo" src="${logoUrl}" alt="Ariane Andrade" />
          <p class="doc-title">Relatório pós-leilão</p>
          <p class="auction">${esc(auctionLine)}</p>
          <div class="company">
            ${esc(ASSESSORIA.name)}<br/>
            CNPJ ${esc(ASSESSORIA.cnpj)} · ${esc(ASSESSORIA.cityUf)}<br/>
            ${esc(ASSESSORIA.email)}
          </div>
        </td>
        <td style="width:170px">
          <div class="idbox">
            <p class="lote">${esc(statusLabel.toUpperCase())}</p>
            <p class="via">RESUMO FINANCEIRO<br/>DO EVENTO</p>
            <p class="num">${esc(meta.location || eventDate)}</p>
            <p class="emi">Gerado: ${esc(generatedAt)}</p>
          </div>
        </td>
      </tr>
    </table>

    <div class="section">
      <div class="section-h">Dados do evento</div>
      <table class="fields">
        <tr>
          <td class="k">Leilão</td>
          <td colspan="3">${esc(meta.name)}</td>
        </tr>
        <tr>
          <td class="k">Data</td>
          <td>${esc(eventDate)}</td>
          <td class="k">Local</td>
          <td>${esc(meta.location || '—')}</td>
        </tr>
        <tr>
          <td class="k">Status</td>
          <td>${esc(statusLabel)}</td>
          <td class="k">Lotes vendidos</td>
          <td>${esc(String(finance.lots_sold))} de ${esc(String(finance.lots_total))}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <div class="section-h">Composição financeira do evento</div>
      <table class="fin">
        <tr>
          <td>
            Arrematações<br/>
            <strong>${esc(money(finance.revenue_total))}</strong>
          </td>
          <td>
            Comissão assessoria (estim.)<br/>
            <strong>${esc(money(finance.assessoria_estimated))}</strong>
          </td>
          <td>
            Despesas do evento<br/>
            <strong>${esc(money(finance.expenses_total))}</strong>
          </td>
          <td>
            Resultado líquido (estim.)<br/>
            <strong class="${resultClass}">${esc(money(finance.result_net))}</strong>
          </td>
        </tr>
      </table>
      <div class="pay-summary">
        Comissão calculada com base nas regras de repasse dos contratos · Despesas conforme lançamentos do evento.
      </div>
    </div>

    <div class="section">
      <div class="section-h">Contratos do evento</div>
      ${
        finance.contracts.length
          ? `<table class="data">
        <thead>
          <tr>
            <th>Lote</th>
            <th>Animal</th>
            <th>Comprador</th>
            <th>Valor</th>
            <th>Comissão assessoria</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${contractRows}</tbody>
      </table>
      <div class="pay-summary">Contratos não cancelados vinculados a este leilão.</div>`
          : '<p class="empty">Nenhum contrato registrado neste evento.</p>'
      }
    </div>

    <div class="section">
      <div class="section-h">Despesas do evento</div>
      ${
        finance.expenses.length
          ? `<table class="data">
        <thead>
          <tr>
            <th>Data</th>
            <th>Categoria</th>
            <th>Descrição</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>${expenseRows}</tbody>
      </table>`
          : '<p class="empty">Nenhuma despesa lançada para este evento.</p>'
      }
    </div>

    ${
      categoryRows
        ? `<div class="section">
      <div class="section-h">Despesas por categoria</div>
      <table class="data">
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>${categoryRows}</tbody>
      </table>
    </div>`
        : ''
    }

    <p class="legal">
      DOCUMENTO GERADO PELO SISTEMA ARIANE · VALORES ESTIMADOS CONFORME REGRAS DE REPASSE E DESPESAS CADASTRADAS.
    </p>
  </div>
</body>
</html>`;
}

function slugify(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

async function renderPdfFromHtml(html: string, filename: string) {
  const mod = await import('html2pdf.js');
  const html2pdf = (mod as { default: any }).default;

  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const styleContent = parsed.querySelector('style')?.textContent || '';
  const bodyContent = parsed.body.innerHTML;

  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1;';
  document.body.appendChild(host);

  const styleTag = document.createElement('style');
  styleTag.textContent = styleContent;
  host.appendChild(styleTag);

  const content = document.createElement('div');
  content.innerHTML = bodyContent;
  host.appendChild(content);

  const waitImages = () =>
    Promise.all(
      Array.from(content.querySelectorAll('img')).map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener('load', () => resolve(), { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
              })
      )
    );

  try {
    await waitImages();

    await html2pdf()
      .set({
        margin: [8, 8, 8, 8],
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: 794,
          backgroundColor: '#ffffff',
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(content)
      .save();
  } finally {
    host.remove();
  }
}

export async function downloadAuctionReportPdf(
  meta: AuctionReportMeta,
  finance: AuctionFinance
): Promise<void> {
  const html = buildAuctionReportHtml(meta, finance);
  const datePart = meta.auctionDate?.slice(0, 10) || 'sem-data';
  const filename = `relatorio-leilao-${slugify(meta.name) || 'evento'}-${datePart}.pdf`;
  await renderPdfFromHtml(html, filename);
}

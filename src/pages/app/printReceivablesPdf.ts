import type { ReceivablesDashboard } from '../../services/apiService';
import { formatDateTimeBR } from '../../utils/dateTime';

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function esc(s: string | null | undefined) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const STYLES = `
  @page { size: A4; margin: 12mm; }
  body { font-family: Arial, sans-serif; font-size: 9.5pt; color: #222; margin: 0; }
  h1 { font-size: 14pt; margin: 0 0 4px; color: #4F3E32; }
  .meta { font-size: 8pt; color: #666; margin-bottom: 12px; }
  .kpis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 14px; }
  .kpi { border: 1px solid #ddd; padding: 8px; border-radius: 4px; }
  .kpi label { font-size: 7.5pt; text-transform: uppercase; color: #666; }
  .kpi strong { display: block; font-size: 11pt; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-top: 8px; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
  th { background: #4F3E32; color: #fff; }
  h2 { font-size: 10pt; margin: 14px 0 6px; color: #4F3E32; }
`;

function buildHtml(data: ReceivablesDashboard) {
  const aging = data.aging;
  const debtorRows = data.topDebtors
    .map(
      (d) =>
        `<tr><td>${esc(d.clientName)}</td><td>${money(d.overdueAmount)}</td><td>${d.chargesCount}</td><td>${d.oldestDue ? esc(String(d.oldestDue)) : '—'}</td></tr>`
    )
    .join('');
  const overdueRows = data.overdueItems
    .slice(0, 30)
    .map(
      (i) =>
        `<tr><td>${esc(i.clientName)}</td><td>${esc(i.animalName)}</td><td>${esc(String(i.dueDate))}</td><td>${money(i.amount)}</td><td>${i.daysOverdue}d</td></tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${STYLES}</style></head><body>
    <h1>Relatório de Recebíveis</h1>
    <p class="meta">Sistema Ariane · ${esc(formatDateTimeBR(new Date().toISOString()))}</p>
    <div class="kpis">
      <div class="kpi"><label>Em aberto</label><strong>${money(data.openTotal)}</strong><span>${data.openCount} parcela(s)</span></div>
      <div class="kpi"><label>Inadimplente</label><strong>${money(data.overdueTotal)}</strong><span>${data.overdueCount} parcela(s)</span></div>
      <div class="kpi"><label>A vencer</label><strong>${money(aging.current)}</strong></div>
      <div class="kpi"><label>90+ dias</label><strong>${money(aging.d90_plus)}</strong></div>
    </div>
    <h2>Envelhecimento (R$)</h2>
    <table><tr><th>Faixa</th><th>Valor</th></tr>
      <tr><td>A vencer</td><td>${money(aging.current)}</td></tr>
      <tr><td>1–30 dias</td><td>${money(aging.d1_30)}</td></tr>
      <tr><td>31–60 dias</td><td>${money(aging.d31_60)}</td></tr>
      <tr><td>61–90 dias</td><td>${money(aging.d61_90)}</td></tr>
      <tr><td>90+ dias</td><td>${money(aging.d90_plus)}</td></tr>
    </table>
    <h2>Maiores devedores</h2>
    <table><tr><th>Cliente</th><th>Valor</th><th>Parcelas</th><th>Mais antiga</th></tr>${debtorRows || '<tr><td colspan="4">—</td></tr>'}</table>
    <h2>Parcelas atrasadas (amostra)</h2>
    <table><tr><th>Cliente</th><th>Animal</th><th>Vencimento</th><th>Valor</th><th>Dias</th></tr>${overdueRows || '<tr><td colspan="5">Nenhuma</td></tr>'}</table>
  </body></html>`;
}

async function renderPdf(html: string, filename: string) {
  const mod = await import('html2pdf.js');
  const html2pdf = (mod as { default: any }).default;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;';
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    await html2pdf()
      .set({
        margin: 10,
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(host)
      .save();
  } finally {
    document.body.removeChild(host);
  }
}

export async function downloadReceivablesPdf(data: ReceivablesDashboard) {
  const date = new Date().toISOString().slice(0, 10);
  await renderPdf(buildHtml(data), `recebiveis-${date}.pdf`);
}

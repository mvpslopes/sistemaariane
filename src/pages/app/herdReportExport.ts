import * as XLSX from 'xlsx';
import type { Animal } from '../../services/apiService';
import { formatAgeBR, formatDateBR, formatDateTimeBR, todayDateISO } from '../../utils/dateTime';

const SEX_LABEL: Record<string, string> = { M: 'Macho', F: 'Fêmea', C: 'Castrado' };
const STATUS_LABEL: Record<string, string> = {
  ativo: 'Ativo',
  vendido: 'Vendido',
  falecido: 'Falecido',
  transferido: 'Transferido',
};

function esc(s: string | null | undefined) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function animalSexLabel(sex: Animal['sex']) {
  return sex ? SEX_LABEL[sex] || sex : '—';
}

export function animalStatusLabel(status: Animal['status']) {
  return STATUS_LABEL[status] || status;
}

export type HerdReportRow = {
  index: number;
  animal: Animal;
};

export function herdReportRows(animals: Animal[]): HerdReportRow[] {
  return animals.map((animal, index) => ({ index: index + 1, animal }));
}

const STYLES = `
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8.5pt; color: #222; margin: 0; }
  h1 { font-size: 14pt; margin: 0 0 2px; color: #4F3E32; }
  .meta { font-size: 8pt; color: #666; margin-bottom: 10px; }
  .logo { height: 36px; width: auto; display: block; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 3px 5px; text-align: left; vertical-align: top; }
  th { background: #4F3E32; color: #fff; font-size: 7.5pt; text-transform: uppercase; }
  td { font-size: 8pt; }
  .kpis { display: flex; gap: 10px; margin-bottom: 10px; }
  .kpi { border: 1px solid #ddd; padding: 6px 10px; border-radius: 4px; }
  .kpi label { font-size: 7pt; text-transform: uppercase; color: #666; }
  .kpi strong { display: block; font-size: 11pt; color: #4F3E32; }
`;

export async function downloadHerdReportPdf(animals: Animal[], subtitle: string) {
  const logoUrl = `${window.location.origin}/logo-ariane-wide-transparente.png`;
  const generatedAt = formatDateTimeBR(new Date());
  const rows = herdReportRows(animals)
    .map(
      ({ index, animal }) => `<tr>
        <td>${index}</td>
        <td><strong>${esc(animal.name)}</strong></td>
        <td>${esc(animal.registration_no || '—')}</td>
        <td>${esc(animal.chip_no || '—')}</td>
        <td>${esc(animalSexLabel(animal.sex))}</td>
        <td>${esc(animal.owners || '—')}</td>
        <td>${esc(formatDateBR(animal.birth_date))}<br/><span style="color:#666">${esc(formatAgeBR(animal.birth_date))}</span></td>
        <td>${esc(animal.color || '—')}</td>
        <td>${esc(animal.breed || '—')}</td>
        <td>${esc(animal.sire_name || '—')}</td>
        <td>${esc(animal.dam_name || '—')}</td>
        <td>${esc(animalStatusLabel(animal.status))}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${STYLES}</style></head><body>
    <img class="logo" src="${logoUrl}" alt="Ariane"/>
    <h1>Relatório de animais do plantel</h1>
    <p class="meta">Sistema Ariane · ${esc(generatedAt)}${subtitle ? ` · ${esc(subtitle)}` : ''}</p>
    <div class="kpis">
      <div class="kpi"><label>Animais</label><strong>${animals.length}</strong></div>
      <div class="kpi"><label>Ativos</label><strong>${animals.filter((a) => a.status === 'ativo').length}</strong></div>
      <div class="kpi"><label>Fêmeas</label><strong>${animals.filter((a) => a.sex === 'F').length}</strong></div>
      <div class="kpi"><label>Machos</label><strong>${animals.filter((a) => a.sex === 'M').length}</strong></div>
    </div>
    <table>
      <thead><tr>
        <th>#</th><th>Nome</th><th>Registro</th><th>Chip</th><th>Sexo</th>
        <th>Proprietário</th><th>Nascimento / idade</th><th>Pelagem</th>
        <th>Raça</th><th>Pai</th><th>Mãe</th><th>Status</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="12">Nenhum animal no filtro</td></tr>'}</tbody>
    </table>
  </body></html>`;

  const mod = await import('html2pdf.js');
  const html2pdf = (mod as { default: any }).default;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:1122px;background:#fff;';
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    await html2pdf()
      .set({
        margin: 8,
        filename: `plantel-${todayDateISO()}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      })
      .from(host)
      .save();
  } finally {
    document.body.removeChild(host);
  }
}

export function downloadHerdReportExcel(animals: Animal[]) {
  const rows = herdReportRows(animals).map(({ index, animal }) => ({
    '#': index,
    Nome: animal.name,
    Registro: animal.registration_no || '',
    Chip: animal.chip_no || '',
    Sexo: animalSexLabel(animal.sex),
    Proprietário: animal.owners || '',
    Nascimento: formatDateBR(animal.birth_date, ''),
    Idade: formatAgeBR(animal.birth_date, ''),
    Pelagem: animal.color || '',
    Raça: animal.breed || '',
    Associação: animal.association || '',
    Pai: animal.sire_name || '',
    Mãe: animal.dam_name || '',
    Status: animalStatusLabel(animal.status),
  }));
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Nome: '' }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantel');
  XLSX.writeFile(wb, `plantel-${todayDateISO()}.xlsx`);
}

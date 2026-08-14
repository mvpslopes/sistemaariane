/**
 * Registro diário de atendimento — API principal com backup local opcional.
 */

import * as XLSX from 'xlsx';
import {
  deleteDailyReport as apiDeleteDailyReport,
  getDailyReports as apiGetDailyReports,
  getDailyReportTodayStatus,
  saveDailyReport as apiSaveDailyReport,
  type DailyReportPayload,
  type DailyReportRecord,
} from './apiService';

export type DailyReport = DailyReportPayload;
export type DailyReportItem = DailyReportRecord;

export async function saveDailyReport(report: DailyReport): Promise<{ id: string }> {
  const res = await apiSaveDailyReport(report);
  cacheReportsLocally(await apiGetDailyReports().catch(() => []));
  return { id: res.id };
}

export async function getDailyReports(filters?: {
  q?: string;
  userId?: string;
  from?: string;
  to?: string;
}): Promise<DailyReportItem[]> {
  try {
    const reports = await apiGetDailyReports(filters);
    cacheReportsLocally(reports);
    return reports;
  } catch (error) {
    console.error('Erro ao buscar registros diários:', error);
    return readLocalCache();
  }
}

export async function getTodayDailyReportStatus() {
  return getDailyReportTodayStatus();
}

export async function deleteReport(id: string): Promise<void> {
  await apiDeleteDailyReport(id);
}

function cacheReportsLocally(reports: DailyReportItem[]) {
  try {
    localStorage.setItem('dailyReports', JSON.stringify(reports));
  } catch {
    /* ignore quota errors */
  }
}

function readLocalCache(): DailyReportItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem('dailyReports') || '[]');
    return Array.isArray(raw) ? raw.filter((r) => !String(r.id).startsWith('mock-')) : [];
  } catch {
    return [];
  }
}

export function exportToExcel(reports: DailyReportItem[]): void {
  try {
    const data = reports.map((report) => {
      const ocorrencias = report.ocorrencias || {
        clienteIrritado: false,
        cobrancaIndevida: false,
        questionamentoFinanceiro: false,
        contestacaoRegras: false,
        escaladoGestao: false,
        nenhumaCritica: false,
      };
      return {
        Data: report.dataLabel || report.data || '',
        Colaboradora: report.colaboradora || '',
        'Nº Atendimentos': report.numAtendimentos || '',
        'Todos Clientes Respondidos': report.todosClientesRespondidos ? 'Sim' : 'Não',
        'Clientes Pendentes': report.clientesPendentes || '',
        'Cliente Irritado': ocorrencias.clienteIrritado ? 'Sim' : 'Não',
        'Cobrança Indevida': ocorrencias.cobrancaIndevida ? 'Sim' : 'Não',
        'Questionamento Financeiro': ocorrencias.questionamentoFinanceiro ? 'Sim' : 'Não',
        'Contestação Regras': ocorrencias.contestacaoRegras ? 'Sim' : 'Não',
        'Escalado Gestão': ocorrencias.escaladoGestao ? 'Sim' : 'Não',
        'Nenhuma Crítica': ocorrencias.nenhumaCritica ? 'Sim' : 'Não',
        'Suporte Gestão': report.suporteGestao ? 'Sim' : 'Não',
        'Suporte Colegas': report.suporteColegas ? 'Sim' : 'Não',
        'Motivo Suporte': report.motivoSuporte || '',
        Autoavaliação: report.autoavaliacao || '',
        'Compromissos Amanhã': report.compromissosAmanha || '',
        'Data/Hora Registro': report.timestamp
          ? new Date(report.timestamp).toLocaleString('pt-BR')
          : '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = [
      { wch: 12 },
      { wch: 18 },
      { wch: 16 },
      { wch: 22 },
      { wch: 28 },
      { wch: 14 },
      { wch: 16 },
      { wch: 22 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 28 },
      { wch: 14 },
      { wch: 36 },
      { wch: 20 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Registros de Atendimento');
    const fileName = `registros_atendimento_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  } catch (error) {
    console.error('Erro ao exportar:', error);
    throw new Error('Erro ao exportar o arquivo. Tente novamente.');
  }
}

export const ATTENDANCE_BANDS = ['Até 10', '11 a 20', '21 a 30', 'Acima de 30'] as const;
export const SELF_RATINGS = ['Excelente', 'Bom', 'Regular', 'Precisa melhorar'] as const;

export const OCORRENCIA_OPTIONS = [
  { key: 'clienteIrritado', label: 'Cliente irritado' },
  { key: 'cobrancaIndevida', label: 'Cobrança indevida' },
  { key: 'questionamentoFinanceiro', label: 'Questionamento financeiro' },
  { key: 'contestacaoRegras', label: 'Contestação de regras / contrato' },
  { key: 'escaladoGestao', label: 'Situação escalada para a gestão' },
  { key: 'nenhumaCritica', label: 'Nenhuma situação crítica hoje' },
] as const;

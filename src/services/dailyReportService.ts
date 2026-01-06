/**
 * Serviço para salvar registros diários de atendimento
 * Suporta API MySQL (backend), Firebase Firestore e localStorage como fallback
 */

import * as XLSX from 'xlsx';
import { db } from '../config/firebase';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import * as apiService from './apiService';

export interface DailyReport {
  data: string; // Data do registro
  colaboradora: string; // Nome da colaboradora
  numAtendimentos: string; // Faixa de atendimentos
  todosClientesRespondidos: boolean;
  clientesPendentes: string; // Motivo se houver
  ocorrencias: {
    clienteIrritado: boolean;
    cobrancaIndevida: boolean;
    questionamentoFinanceiro: boolean;
    contestacaoRegras: boolean;
    escaladoGestao: boolean;
    nenhumaCritica: boolean;
  };
  suporteGestao: boolean;
  suporteColegas: boolean;
  motivoSuporte: string;
  autoavaliacao: string; // Excelente, Bom, Regular, Precisa melhorar
  compromissosAmanha: string;
  declaracao: boolean;
}

export async function saveDailyReport(report: DailyReport): Promise<boolean> {
  const API_URL = import.meta.env.VITE_API_URL;
  
  // Sempre tentar salvar via API (MySQL) primeiro - persistência principal
  if (API_URL) {
    try {
      await apiService.saveDailyReport(report);
      console.log('Registro salvo via API (MySQL)');
      // Também salvar no localStorage como backup offline
      saveToLocalStorage(report);
      return true;
    } catch (error) {
      console.error('Erro ao salvar via API:', error);
      // Se falhar, tentar Firebase ou localStorage apenas como fallback
    }
  }

  // Tentar salvar no Firebase se API não estiver configurada
  if (db) {
    try {
      const reportData = {
        ...report,
        timestamp: Timestamp.now(),
        createdAt: Timestamp.now(),
      };
      
      await addDoc(collection(db, 'dailyReports'), reportData);
      console.log('Registro salvo no Firebase');
      
      // Também salvar no localStorage como backup
      saveToLocalStorage(report);
      return true;
    } catch (error) {
      console.error('Erro ao salvar no Firebase:', error);
      // Se falhar, tentar salvar no localStorage
      saveToLocalStorage(report);
      return true;
    }
  }
  
  // Fallback para localStorage apenas se não houver API configurada
  console.warn('API não configurada. Salvando apenas no localStorage.');
  saveToLocalStorage(report);
  return true;
}

function saveToLocalStorage(report: DailyReport) {
  try {
    const reports = JSON.parse(localStorage.getItem('dailyReports') || '[]');
    // Filtrar dados fictícios antes de adicionar novo registro
    const realReports = reports.filter((r: any) => !r.id?.toString().startsWith('mock-'));
    realReports.push({
      ...report,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem('dailyReports', JSON.stringify(realReports));
  } catch (error) {
    console.error('Erro ao salvar no localStorage:', error);
  }
}

export async function getDailyReports(colaboradora?: string): Promise<any[]> {
  const API_URL = import.meta.env.VITE_API_URL;
  
  // Sempre tentar buscar via API (MySQL) primeiro - fonte principal de dados
  if (API_URL) {
    try {
      const reports = await apiService.getDailyReports(colaboradora);
      console.log('Registros carregados via API (MySQL)');
      // Limpar dados fictícios e sincronizar com dados reais do banco
      // Substituir completamente pelo que veio do banco (remove dados fictícios)
      localStorage.setItem('dailyReports', JSON.stringify(reports));
      return reports;
    } catch (error) {
      console.error('Erro ao buscar via API:', error);
      // Se falhar, tentar buscar do localStorage como fallback offline
      const localReports = getDailyReportsFromLocalStorage();
      if (localReports.length > 0) {
        console.warn('Usando dados do localStorage (modo offline)');
        return localReports;
      }
      // Se não houver dados locais, retornar vazio
      return [];
    }
  }

  // Tentar buscar do Firebase se API não estiver configurada
  if (db) {
    try {
      const q = query(collection(db, 'dailyReports'), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const reports = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp,
          data: data.data || (data.timestamp?.toDate?.()?.toLocaleDateString('pt-BR') || ''),
        };
      });
      
      // Sincronizar com localStorage como backup
      if (reports.length > 0) {
        localStorage.setItem('dailyReports', JSON.stringify(reports));
      }
      
      return reports;
    } catch (error) {
      console.error('Erro ao buscar do Firebase:', error);
      // Se falhar, buscar do localStorage
      return getDailyReportsFromLocalStorage();
    }
  }
  
  // Se não houver API configurada, retornar vazio (não usar localStorage com dados fictícios)
  console.warn('API não configurada. Configure VITE_API_URL no .env para usar o banco de dados.');
  // Limpar localStorage de dados fictícios
  const localReports = getDailyReportsFromLocalStorage();
  if (localReports.length > 0) {
    localStorage.setItem('dailyReports', JSON.stringify(localReports));
  }
  return localReports;
}

function getDailyReportsFromLocalStorage(): any[] {
  try {
    const reports = JSON.parse(localStorage.getItem('dailyReports') || '[]');
    // Filtrar dados fictícios (que começam com "mock-" no ID)
    const realReports = reports.filter((r: any) => !r.id?.toString().startsWith('mock-'));
    return realReports;
  } catch (error) {
    console.error('Erro ao ler do localStorage:', error);
    return [];
  }
}

export function exportToExcel(reports: any[]): void {
  try {
    // Converter dados para array de objetos
    const data = reports.map((report) => {
      const ocorrencias = report.ocorrencias || {};
      return {
        'Data': report.data || '',
        'Colaboradora': report.colaboradora || '',
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
        'Autoavaliação': report.autoavaliacao || '',
        'Compromissos Amanhã': report.compromissosAmanha || '',
        'Data/Hora Registro': report.timestamp ? new Date(report.timestamp).toLocaleString('pt-BR') : '',
      };
    });
    
    // Criar workbook e worksheet
    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // Ajustar largura das colunas
    const columnWidths = [
      { wch: 12 }, // Data
      { wch: 15 }, // Colaboradora
      { wch: 18 }, // Nº Atendimentos
      { wch: 25 }, // Todos Clientes Respondidos
      { wch: 30 }, // Clientes Pendentes
      { wch: 15 }, // Cliente Irritado
      { wch: 18 }, // Cobrança Indevida
      { wch: 25 }, // Questionamento Financeiro
      { wch: 20 }, // Contestação Regras
      { wch: 15 }, // Escalado Gestão
      { wch: 15 }, // Nenhuma Crítica
      { wch: 15 }, // Suporte Gestão
      { wch: 15 }, // Suporte Colegas
      { wch: 30 }, // Motivo Suporte
      { wch: 15 }, // Autoavaliação
      { wch: 40 }, // Compromissos Amanhã
      { wch: 20 }, // Data/Hora Registro
    ];
    
    worksheet['!cols'] = columnWidths;
    
    // Criar workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Registros de Atendimento');
    
    // Gerar arquivo XLSX
    const fileName = `registros_atendimento_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  } catch (error) {
    console.error('Erro ao exportar para Excel:', error);
    alert('Erro ao exportar o arquivo. Tente novamente.');
  }
}

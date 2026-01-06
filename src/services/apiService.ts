/**
 * Serviço de API para comunicação com o backend MySQL
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
// Para PHP, adiciona /api.php automaticamente se não estiver presente
const API_URL = API_BASE_URL.endsWith('/api.php') || API_BASE_URL.includes('/api.php/') 
  ? API_BASE_URL 
  : `${API_BASE_URL}/api.php`;

export interface LoginResponse {
  success: boolean;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface DailyReport {
  data: string;
  colaboradora: string;
  numAtendimentos: string;
  todosClientesRespondidos: boolean;
  clientesPendentes: string;
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
  autoavaliacao: string;
  compromissosAmanha: string;
  declaracao: boolean;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao fazer login');
  }

  return response.json();
}

export async function getDailyReports(colaboradora?: string): Promise<any[]> {
  const url = colaboradora 
    ? `${API_URL}/reports?colaboradora=${encodeURIComponent(colaboradora)}`
    : `${API_URL}/reports`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao buscar registros');
  }

  return response.json();
}

export async function saveDailyReport(report: DailyReport): Promise<{ success: boolean; id: string }> {
  const response = await fetch(`${API_URL}/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(report),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao salvar registro');
  }

  return response.json();
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_URL}/change-password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      currentPassword,
      newPassword,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao alterar senha');
  }

  return response.json();
}

export async function deleteReport(reportId: string, colaboradora: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_URL}/reports`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: reportId,
      colaboradora,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao deletar registro');
  }

  return response.json();
}


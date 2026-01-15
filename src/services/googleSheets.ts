/**
 * Serviço para salvar dados do diagnóstico no Google Sheets
 * 
 * IMPORTANTE: Para usar este serviço, você precisa:
 * 1. Criar um Google Apps Script que receberá os dados
 * 2. Publicar o script como Web App
 * 3. Configurar a URL do Web App na variável de ambiente
 * 
 * Exemplo de Google Apps Script:
 * 
 * function doPost(e) {
 *   try {
 *     const sheet = SpreadsheetApp.openById('SEU_SPREADSHEET_ID').getActiveSheet();
 *     const data = JSON.parse(e.postData.contents);
 *     
 *     const row = [
 *       new Date(),
 *       data.nome,
 *       data.whatsapp,
 *       data.score,
 *       data.nivel,
 *       JSON.stringify(data.respostas),
 *       data.recomendacoes.join(' | ')
 *     ];
 *     
 *     sheet.appendRow(row);
 *     
 *     return ContentService.createTextOutput(JSON.stringify({ success: true }))
 *       .setMimeType(ContentService.MimeType.JSON);
 *   } catch (error) {
 *     return ContentService.createTextOutput(JSON.stringify({ 
 *       success: false, 
 *       error: error.toString() 
 *     })).setMimeType(ContentService.MimeType.JSON);
 *   }
 * }
 */

export interface DiagnosticData {
  nome: string;
  whatsapp: string;
  score: number;
  nivel: string;
  respostas: Record<string, number>;
  recomendacoes: string[];
}

const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || '';

export async function saveDiagnosticToSheets(data: DiagnosticData): Promise<boolean> {
  if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.trim() === '') {
    console.warn('Google Script URL não configurada. Dados não serão salvos.');
    return false;
  }

  try {
    // Usar um timeout para evitar que a requisição fique travada
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos de timeout

    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // Google Apps Script não retorna CORS headers adequados
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      // Com no-cors, não podemos verificar a resposta, mas assumimos sucesso
      // Em produção, você pode usar um proxy ou configurar CORS no Apps Script
      return true;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Se foi abortado por timeout, não é um erro crítico
      if (fetchError.name === 'AbortError') {
        console.warn('Timeout ao salvar no Google Sheets. Dados podem não ter sido salvos.');
        return false;
      }
      
      // Outros erros de fetch
      console.error('Erro na requisição ao Google Sheets:', fetchError);
      return false;
    }
  } catch (error) {
    console.error('Erro ao salvar no Google Sheets:', error);
    return false;
  }
}

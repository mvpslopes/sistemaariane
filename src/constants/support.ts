/** Contato do responsável técnico do sistema. */
export const TECH_SUPPORT = {
  whatsapp: '5531982304737',
  phoneDisplay: '(31) 98230-4737',
  contactName: 'Marcus — responsável técnico',
  hours: 'Segunda a sexta, 9h às 18h',
} as const;

export function supportWhatsAppHref(message: string) {
  return `https://wa.me/${TECH_SUPPORT.whatsapp}?text=${encodeURIComponent(message)}`;
}

export function buildSupportMessage(userName?: string, pagePath?: string) {
  const who = userName?.trim() ? userName.trim() : 'usuário do sistema';
  const where = pagePath ? `\nTela: ${pagePath}` : '';
  return `Olá! Preciso de suporte técnico no Sistema Ariane.\nUsuário: ${who}${where}`;
}

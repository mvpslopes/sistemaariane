export const AUDIT_ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  login_failed: 'Login falhou',
  logout: 'Logout',
  create: 'Criação',
  update: 'Alteração',
  delete: 'Exclusão',
  export: 'Exportação',
  status_change: 'Mudança de status',
  sign: 'Assinatura',
  clicksign_send: 'Envio Clicksign',
  clicksign_notify: 'Reenvio Clicksign',
  clicksign_cancel: 'Cancelamento Clicksign',
};

export const AUDIT_RESOURCE_LABELS: Record<string, string> = {
  auth: 'Autenticação',
  clients: 'Clientes / pessoas',
  animals: 'Animais',
  contracts: 'Contratos',
  charges: 'Cobranças',
  auctions: 'Leilões',
  auction_expenses: 'Despesas de leilão',
  auction_lots: 'Lotes de leilão',
  users: 'Usuários',
  uploads: 'Arquivos enviados',
  repasses: 'Repasses',
  receivables: 'Recebíveis',
};

export const AUDIT_ROLE_LABELS: Record<string, string> = {
  root: 'Root',
  admin: 'Administrador',
  user: 'Operador',
  cliente: 'Cliente',
};

export const AUDIT_RESOURCE_FILTERS = [
  { id: 'all', label: 'Todos os módulos' },
  { id: 'auth', label: 'Autenticação' },
  { id: 'clients', label: 'Clientes' },
  { id: 'animals', label: 'Animais' },
  { id: 'contracts', label: 'Contratos' },
  { id: 'charges', label: 'Cobranças' },
  { id: 'auctions', label: 'Leilões' },
  { id: 'auction_lots', label: 'Lotes de leilão' },
  { id: 'auction_expenses', label: 'Despesas leilão' },
  { id: 'users', label: 'Usuários' },
] as const;

export const AUDIT_ACTION_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'login', label: 'Logins' },
  { id: 'login_failed', label: 'Falhas' },
  { id: 'create', label: 'Criações' },
  { id: 'update', label: 'Alterações' },
  { id: 'delete', label: 'Exclusões' },
  { id: 'status_change', label: 'Status / Clicksign' },
  { id: 'sign', label: 'Assinaturas' },
] as const;

export function auditActionLabel(action: string) {
  return AUDIT_ACTION_LABELS[action] || action;
}

export function auditResourceLabel(resource: string) {
  return AUDIT_RESOURCE_LABELS[resource] || resource;
}

export function auditRoleLabel(role: string | null | undefined) {
  if (!role) return '—';
  return AUDIT_ROLE_LABELS[role] || role;
}

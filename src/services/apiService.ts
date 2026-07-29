/**
 * API client — MVP Sistema Haras
 */

const RAW_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/** Normaliza base: Node (/api) ou PHP (.../api.php) */
function resolveBaseUrl(): string {
  if (RAW_URL.includes('api.php')) return RAW_URL.replace(/\/$/, '');
  return RAW_URL.replace(/\/$/, '');
}

const API_URL = resolveBaseUrl();

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = [data.error, data.detail, data.hint].filter(Boolean).join(' — ');
    throw new Error(msg || 'Erro na requisição');
  }
  return data as T;
}

export type Role = 'root' | 'admin' | 'user' | 'cliente';

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  name: string;
  avatarUrl?: string | null;
  role: Role;
  clientId: string | null;
  active?: boolean;
  mustChangePassword?: boolean;
}

export interface Client {
  id: string;
  name: string;
  document_type: 'CPF' | 'CNPJ';
  document: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  is_seller?: boolean;
  is_buyer?: boolean;
  is_assessor?: boolean;
  created_at?: string;
}

export type SaleType = 'inteiro' | 'fracao' | 'condominio';
export type PaymentMethod = 'pix' | 'boleto' | 'transferencia' | 'outro';
export type ContractStatus = 'rascunho' | 'aguardando_assinatura' | 'ativo' | 'concluido' | 'cancelado';
export type ChargeStatus = 'pendente' | 'pago' | 'atrasado' | 'cancelado';

export interface Contract {
  id: string;
  animal_id: string;
  animal_name?: string | null;
  sale_type: SaleType;
  share_pct: number | null;
  seller_id: string;
  seller_name?: string | null;
  buyer_id: string;
  buyer_name?: string | null;
  assessor_id: string | null;
  assessor_name?: string | null;
  total_amount: number;
  payment_method: PaymentMethod;
  installments: number;
  first_due_date: string;
  status: ContractStatus;
  notes: string | null;
  created_at?: string;
  signatures?: ContractSignature[];
  charges?: Charge[];
}

export interface ContractSignature {
  id: string;
  party_role: 'seller' | 'buyer' | 'assessor';
  client_id: string;
  signer_name: string;
  signed_at: string;
  ip?: string | null;
}

export interface Charge {
  id: string;
  contract_id: string;
  client_id: string;
  client_name?: string;
  animal_name?: string;
  installment_no: number;
  amount: number;
  due_date: string;
  payment_method: PaymentMethod;
  status: ChargeStatus;
  paid_at: string | null;
  notes: string | null;
}

export interface AnimalOwnerInput {
  clientId: string;
  sharePct?: number;
  isPrimary?: boolean;
}

export interface Animal {
  id: string;
  name: string;
  registration_no: string | null;
  chip_no: string | null;
  sex: 'M' | 'F' | null;
  breed: string | null;
  association: 'ABCCMM' | 'ABQM' | 'OUTRA' | 'NENHUMA';
  birth_date: string | null;
  color: string | null;
  resenha: string | null;
  status: 'ativo' | 'vendido' | 'falecido' | 'transferido';
  ownership_type: 'unico' | 'condominio';
  notes: string | null;
  photo_url: string | null;
  owners?: string | null;
  created_at?: string;
}

export interface AnimalDetail extends Animal {
  owners: Array<{
    id: string;
    clientId: string;
    clientName: string;
    sharePct: number;
    isPrimary: boolean;
  }>;
  genealogy: {
    sireId: string | null;
    damId: string | null;
    sireName: string | null;
    damName: string | null;
  } | null;
}

export interface DashboardStats {
  clients: number;
  buyers: number;
  sellers: number;
  assessors: number;
  animals: number;
  activeAnimals: number;
  contracts: number;
  contractsActive: number;
  contractsAwaiting: number;
  chargesPending: number;
  chargesOverdue: number;
  chargesPaid: number;
  users?: number;
}

export async function login(username: string, password: string) {
  return request<{ success: boolean; token: string; user: AuthUser }>('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function getMe() {
  return request<{ user: AuthUser }>('/me');
}

export async function updateProfile(data: { name: string; avatarUrl?: string | null }) {
  return request<{ success: boolean; user: AuthUser }>('/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return request<{ success: boolean; message: string }>('/change-password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function getDashboard() {
  return request<DashboardStats>('/dashboard');
}

export async function getClients(q?: string, role?: 'seller' | 'buyer' | 'assessor') {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (role) params.set('role', role);
  const qs = params.toString() ? `?${params}` : '';
  return request<Client[]>(`/clients${qs}`);
}

export async function getClient(id: string) {
  return request<Client>(`/clients/${id}`);
}

export async function createClient(data: Partial<Client>) {
  return request<{ success: boolean; id: string }>('/clients', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateClient(id: string, data: Partial<Client>) {
  return request<{ success: boolean }>(`/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteClient(id: string) {
  return request<{ success: boolean }>(`/clients/${id}`, { method: 'DELETE' });
}

/** @deprecated use deleteClient */
export async function deactivateClient(id: string) {
  return deleteClient(id);
}

export async function getAnimals(q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  return request<Animal[]>(`/animals${qs}`);
}

export async function getAnimal(id: string) {
  return request<AnimalDetail>(`/animals/${id}`);
}

export async function createAnimal(data: Record<string, unknown>) {
  return request<{ success: boolean; id: string }>('/animals', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAnimal(id: string, data: Record<string, unknown>) {
  return request<{ success: boolean }>(`/animals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteAnimal(id: string) {
  return request<{ success: boolean }>(`/animals/${id}`, { method: 'DELETE' });
}

/** @deprecated use deleteAnimal */
export async function archiveAnimal(id: string) {
  return deleteAnimal(id);
}

/** Resolve URL de mídia (foto) relativa ou absoluta */
export function mediaUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const origin = API_URL.includes('api.php')
    ? API_URL.replace(/\/api\.php.*$/i, '')
    : API_URL.replace(/\/api\/?$/i, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  // Em Node local, uploads ficam no mesmo host da API (porta 3000)
  if (!API_URL.includes('api.php') && typeof window !== 'undefined') {
    const apiOrigin = new URL(API_URL, window.location.origin).origin;
    return `${apiOrigin}${normalized}`;
  }
  return `${origin || (typeof window !== 'undefined' ? window.location.origin : '')}${normalized}`;
}

export async function uploadAnimalPhoto(file: File) {
  return uploadMedia(file, 'animal');
}

export async function uploadAvatar(file: File) {
  return uploadMedia(file, 'avatar');
}

async function uploadMedia(file: File, kind: 'animal' | 'avatar') {
  const token = getToken();
  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);

  const response = await fetch(`${API_URL}/upload?kind=${encodeURIComponent(kind)}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Erro ao enviar foto');
  }
  return data as { success: boolean; url: string };
}

export async function getUsers() {
  return request<AuthUser[]>('/users');
}

export async function createUser(data: Record<string, unknown>) {
  return request<{ success: boolean; id: string }>('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateUser(id: string, data: Record<string, unknown>) {
  return request<{ success: boolean }>(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getContracts(filters?: { animalId?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.animalId) params.set('animalId', filters.animalId);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString() ? `?${params}` : '';
  return request<Contract[]>(`/contracts${qs}`);
}

export async function getContract(id: string) {
  return request<Contract>(`/contracts/${id}`);
}

export async function createContract(data: Record<string, unknown>) {
  return request<{ success: boolean; id: string }>('/contracts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateContract(id: string, data: Record<string, unknown>) {
  return request<{ success: boolean }>(`/contracts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function signContract(
  id: string,
  data: { partyRole: string; signerName: string; accepted: boolean }
) {
  return request<{ success: boolean; activated: boolean }>(`/contracts/${id}/sign`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getCharges(filters?: { status?: string; contractId?: string; clientId?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.contractId) params.set('contractId', filters.contractId);
  if (filters?.clientId) params.set('clientId', filters.clientId);
  const qs = params.toString() ? `?${params}` : '';
  return request<Charge[]>(`/charges${qs}`);
}

export async function updateCharge(id: string, data: { status: ChargeStatus; notes?: string }) {
  return request<{ success: boolean }>(`/charges/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

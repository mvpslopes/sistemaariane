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
  created_at?: string;
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
  animals: number;
  activeAnimals: number;
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

export async function changePassword(currentPassword: string, newPassword: string) {
  return request<{ success: boolean; message: string }>('/change-password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function getDashboard() {
  return request<DashboardStats>('/dashboard');
}

export async function getClients(q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
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
  const token = getToken();
  const form = new FormData();
  form.append('file', file);

  const response = await fetch(`${API_URL}/upload`, {
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

/**
 * API client — MVP Sistema Haras
 */

function defaultApiUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `${window.location.origin}/api.php`;
    }
  }
  return 'http://localhost:3000/api';
}

const RAW_URL = import.meta.env.VITE_API_URL || defaultApiUrl();

/** Normaliza base: Node (/api) ou PHP (.../api.php) */
function resolveBaseUrl(): string {
  if (RAW_URL.includes('api.php')) return RAW_URL.replace(/\/$/, '');
  return RAW_URL.replace(/\/$/, '');
}

const API_URL = resolveBaseUrl();

function getToken(): string | null {
  return localStorage.getItem('token');
}

let handlingUnauthorized = false;

/** Limpa sessão e manda para o login (exceto na própria tela de login). */
export function handleUnauthorized() {
  if (handlingUnauthorized) return;
  handlingUnauthorized = true;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  if (path.includes('/login')) {
    handlingUnauthorized = false;
    return;
  }
  if (typeof window !== 'undefined') {
    window.location.assign('/login?expired=1');
  }
}

function isAuthLoginPath(path: string) {
  const clean = path.split('?')[0].replace(/\/+$/, '');
  return clean === '/login' || clean.endsWith('/login');
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
    if (response.status === 401 && !isAuthLoginPath(path)) {
      handleUnauthorized();
    }
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
  rg?: string | null;
  rg_issuer?: string | null;
  birth_date?: string | null;
  nickname?: string | null;
  marital_status?: string | null;
  profession?: string | null;
  mother_name?: string | null;
  father_name?: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  address_number?: string | null;
  zip_code?: string | null;
  country?: string | null;
  notes: string | null;
  relationship_notes?: string | null;
  problems_notes?: string | null;
  active: boolean;
  is_seller?: boolean;
  is_buyer?: boolean;
  is_assessor?: boolean;
  is_witness?: boolean;
  is_avalista?: boolean;
  /** Haras/fazenda principal (quando cadastrada em propriedades) */
  property_name?: string | null;
  created_at?: string;
}

export type PersonDocType = 'rg' | 'identidade' | 'cnh' | 'comprovante_residencia' | 'selfie' | 'outro';

export interface ClientDocument {
  id: string;
  client_id: string;
  doc_type: PersonDocType;
  file_url: string;
  file_name: string | null;
  notes: string | null;
  created_at?: string;
}

export interface ClientProperty {
  id: string;
  client_id: string;
  name: string;
  cnpj: string | null;
  state_registration: string | null;
  zip_code: string | null;
  state: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  property_type: string | null;
  is_primary: boolean;
  manager_name: string | null;
  manager_phone: string | null;
  manager_email: string | null;
  notes: string | null;
}

export interface ClientBankAccount {
  id: string;
  client_id: string;
  account_type: 'corrente' | 'poupanca' | 'pagamento' | 'outro';
  bank_name: string;
  agency: string | null;
  account_number: string | null;
  holder_name: string | null;
  holder_document: string | null;
  is_primary: boolean;
  notes: string | null;
}

export interface ClientContact {
  id: string;
  client_id: string;
  name: string;
  role_label: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

export type SaleType = string;
export type PaymentMethod = 'pix' | 'boleto' | 'transferencia' | 'outro';
export type ContractStatus = 'rascunho' | 'aguardando_assinatura' | 'ativo' | 'concluido' | 'cancelado';
export type ChargeStatus = 'pendente' | 'pago' | 'atrasado' | 'cancelado';
export type PayoutStatus = 'aguardando' | 'pendente' | 'pago' | 'cancelado';
export type PayoutRole = 'assessoria' | 'seller' | 'assessor' | 'outro';
export type AuctionStatus = 'rascunho' | 'agendado' | 'em_andamento' | 'encerrado' | 'cancelado';
export type LotStatus = 'disponivel' | 'arrematado' | 'retirado';

export interface Contract {
  id: string;
  animal_id: string;
  animal_name?: string | null;
  animal_chip?: string | null;
  animal_color?: string | null;
  animal_birth_date?: string | null;
  animal_sex?: string | null;
  animal_notes?: string | null;
  sale_type: SaleType;
  share_pct: number | null;
  seller_id: string;
  seller_name?: string | null;
  seller_document?: string | null;
  seller_document_type?: string | null;
  seller_email?: string | null;
  seller_phone?: string | null;
  seller_whatsapp?: string | null;
  seller_address?: string | null;
  seller_city?: string | null;
  seller_state?: string | null;
  buyer_id: string;
  buyer_name?: string | null;
  buyer_document?: string | null;
  buyer_document_type?: string | null;
  buyer_email?: string | null;
  buyer_phone?: string | null;
  buyer_whatsapp?: string | null;
  buyer_address?: string | null;
  buyer_city?: string | null;
  buyer_state?: string | null;
  assessor_id: string | null;
  assessor_name?: string | null;
  auction_id?: string | null;
  auction_name?: string | null;
  auction_date?: string | null;
  lot_id?: string | null;
  template_id?: string | null;
  template_name?: string | null;
  template_title?: string | null;
  template_body?: string | null;
  contract_number?: string | null;
  lot_label?: string | null;
  animal_category?: string | null;
  quantity?: number;
  commission_total_pct?: number | null;
  commission_buyer_pct?: number | null;
  commission_seller_pct?: number | null;
  witness1_id?: string | null;
  witness1_name?: string | null;
  witness1_email?: string | null;
  witness1_phone?: string | null;
  witness1_whatsapp?: string | null;
  witness2_id?: string | null;
  witness2_name?: string | null;
  witness2_email?: string | null;
  witness2_phone?: string | null;
  witness2_whatsapp?: string | null;
  via_label?: string | null;
  clicksign_envelope_id?: string | null;
  clicksign_document_id?: string | null;
  clicksign_status?: string | null;
  clicksign_sent_at?: string | null;
  total_amount: number;
  payment_method: PaymentMethod;
  installments: number;
  first_due_date: string;
  status: ContractStatus;
  notes: string | null;
  created_at?: string;
  signatures?: ContractSignature[];
  charges?: Charge[];
  payoutRules?: PayoutRule[];
}

export interface ContractTemplate {
  id: string;
  name: string;
  code: string | null;
  title: string;
  body_text: string;
  is_default: boolean;
  active: boolean;
  notes: string | null;
  created_at?: string;
}

export interface PayoutRule {
  id?: string;
  beneficiary_role: PayoutRole;
  beneficiary_client_id: string | null;
  beneficiary_name?: string | null;
  label?: string | null;
  pct: number;
}

export interface Payout {
  id: string;
  contract_id: string;
  charge_id: string;
  installment_no: number;
  beneficiary_role: PayoutRole;
  beneficiary_client_id: string | null;
  beneficiary_name?: string | null;
  label?: string | null;
  pct: number;
  amount: number;
  status: PayoutStatus;
  paid_at: string | null;
  notes: string | null;
  animal_name?: string | null;
  charge_status?: string | null;
  charge_due_date?: string | null;
}

export interface Auction {
  id: string;
  name: string;
  auction_date: string | null;
  location: string | null;
  organizer: string | null;
  status: AuctionStatus;
  notes: string | null;
  lots_count?: number | null;
  created_at?: string;
  lots?: AuctionLot[];
}

export interface AuctionLot {
  id: string;
  auction_id: string;
  animal_id: string;
  animal_name?: string | null;
  lot_number: string | null;
  seller_id: string;
  seller_name?: string | null;
  sellers?: Array<{
    clientId: string;
    clientName: string;
    sharePct: number;
    isPrimary: boolean;
  }>;
  min_price: number | null;
  conditions_text: string | null;
  status: LotStatus;
  contract_id: string | null;
  created_at?: string;
}

export interface ContractSignature {
  id: string;
  party_role: 'seller' | 'buyer' | 'assessor' | 'witness1' | 'witness2';
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
  sex: 'M' | 'F' | 'C' | null;
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
  witnesses: number;
  avalistas: number;
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

export async function updateProfile(data: { name: string }) {
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

export async function getClients(q?: string, role?: 'seller' | 'buyer' | 'assessor' | 'witness' | 'avalista') {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (role) params.set('role', role);
  const qs = params.toString() ? `?${params}` : '';
  return request<Client[]>(`/clients${qs}`);
}

export async function getClient(id: string) {
  return request<Client>(`/clients/${id}`);
}

export async function getClientAccessUser(clientId: string) {
  return request<{ user: AuthUser | null }>(`/clients/${clientId}/access-user`);
}

export async function createClientAccessUser(clientId: string) {
  return request<{
    success: boolean;
    user: AuthUser;
    defaultPassword: string;
    message: string;
  }>(`/clients/${clientId}/access-user`, { method: 'POST' });
}

export async function resetClientAccessPassword(clientId: string, password: string) {
  return request<{ success: boolean; message: string }>(`/clients/${clientId}/access-user/password`, {
    method: 'PUT',
    body: JSON.stringify({ password }),
  });
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

export async function getClientDocuments(clientId: string) {
  return request<ClientDocument[]>(`/clients/${clientId}/documents`);
}

export async function createClientDocument(
  clientId: string,
  data: { docType: PersonDocType; fileUrl: string; fileName?: string; notes?: string }
) {
  return request<{ success: boolean; id: string }>(`/clients/${clientId}/documents`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteClientDocument(clientId: string, docId: string) {
  return request<{ success: boolean }>(`/clients/${clientId}/documents/${docId}`, { method: 'DELETE' });
}

export async function getClientProperties(clientId: string) {
  return request<ClientProperty[]>(`/clients/${clientId}/properties`);
}

export async function createClientProperty(clientId: string, data: Record<string, unknown>) {
  return request<{ success: boolean; id: string }>(`/clients/${clientId}/properties`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateClientProperty(clientId: string, propId: string, data: Record<string, unknown>) {
  return request<{ success: boolean }>(`/clients/${clientId}/properties/${propId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteClientProperty(clientId: string, propId: string) {
  return request<{ success: boolean }>(`/clients/${clientId}/properties/${propId}`, { method: 'DELETE' });
}

export async function getClientBankAccounts(clientId: string) {
  return request<ClientBankAccount[]>(`/clients/${clientId}/bank-accounts`);
}

export async function createClientBankAccount(clientId: string, data: Record<string, unknown>) {
  return request<{ success: boolean; id: string }>(`/clients/${clientId}/bank-accounts`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateClientBankAccount(clientId: string, accId: string, data: Record<string, unknown>) {
  return request<{ success: boolean }>(`/clients/${clientId}/bank-accounts/${accId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteClientBankAccount(clientId: string, accId: string) {
  return request<{ success: boolean }>(`/clients/${clientId}/bank-accounts/${accId}`, { method: 'DELETE' });
}

export async function getClientContacts(clientId: string) {
  return request<ClientContact[]>(`/clients/${clientId}/contacts`);
}

export async function createClientContact(clientId: string, data: Record<string, unknown>) {
  return request<{ success: boolean; id: string }>(`/clients/${clientId}/contacts`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateClientContact(clientId: string, contactId: string, data: Record<string, unknown>) {
  return request<{ success: boolean }>(`/clients/${clientId}/contacts/${contactId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteClientContact(clientId: string, contactId: string) {
  return request<{ success: boolean }>(`/clients/${clientId}/contacts/${contactId}`, { method: 'DELETE' });
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

export async function uploadPersonDocument(file: File) {
  return uploadMedia(file, 'person-doc');
}

async function uploadMedia(file: File, kind: 'animal' | 'person-doc') {
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
    if (response.status === 401) handleUnauthorized();
    throw new Error(data.error || 'Erro ao enviar arquivo');
  }
  return data as { success: boolean; url: string; fileName?: string };
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
  return request<{ success: boolean; chargesRecalculated?: boolean }>(`/contracts/${id}`, {
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

export async function sendContractToClicksign(id: string, pdfBase64: string) {
  return request<{
    success: boolean;
    envelopeId: string;
    documentId: string;
    status: string;
    warnings?: string[];
  }>(`/contracts/${id}/clicksign`, {
    method: 'POST',
    body: JSON.stringify({ pdfBase64 }),
  });
}

export interface ClicksignSignerStatus {
  role: string;
  label: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  signerId?: string | null;
  signUrl?: string | null;
  signed: boolean;
  status: 'assinado' | 'pendente' | string;
  statusLabel: string;
  signedAt?: string | null;
}

export interface ClicksignTracking {
  success: boolean;
  envelopeId: string;
  documentId?: string | null;
  status: string;
  statusLabel: string;
  signedCount: number;
  totalCount: number;
  signers: ClicksignSignerStatus[];
  signedFileUrl?: string | null;
}

export async function getClicksignStatus(id: string) {
  return request<ClicksignTracking>(`/contracts/${id}/clicksign`);
}

export async function getClicksignSignedPdfUrl(id: string) {
  return request<{ success: boolean; url: string }>(`/contracts/${id}/clicksign/signed-pdf`);
}

export async function cancelClicksignEnvelope(id: string) {
  return request<{ success: boolean; message: string }>(`/contracts/${id}/clicksign/cancel`, {
    method: 'POST',
  });
}

export async function notifyClicksign(id: string, signerId?: string | null) {
  return request<{ success: boolean; message: string }>(`/contracts/${id}/clicksign/notify`, {
    method: 'POST',
    body: JSON.stringify(signerId ? { signerId } : {}),
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

export interface CatalogItem {
  id: string;
  kind: 'breed' | 'sale_type' | 'animal_category' | 'share_quota';
  name: string;
  code: string | null;
  active?: boolean;
}

export async function getCatalogs(kind: CatalogItem['kind']) {
  return request<CatalogItem[]>(`/catalogs?kind=${encodeURIComponent(kind)}`);
}

export async function createCatalogItem(data: {
  kind: CatalogItem['kind'];
  name: string;
  code?: string | null;
}) {
  return request<{ success: boolean; id: string; kind: string; name: string; code: string | null }>(
    '/catalogs',
    { method: 'POST', body: JSON.stringify(data) }
  );
}

export async function getAuctions() {
  return request<Auction[]>('/auctions');
}

export async function getAuction(id: string) {
  return request<Auction>(`/auctions/${id}`);
}

export async function createAuction(data: Record<string, unknown>) {
  return request<{ success: boolean; id: string }>('/auctions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAuction(id: string, data: Record<string, unknown>) {
  return request<{ success: boolean }>(`/auctions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getAuctionLots(filters?: { auctionId?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.auctionId) params.set('auctionId', filters.auctionId);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString() ? `?${params}` : '';
  return request<AuctionLot[]>(`/auction-lots${qs}`);
}

export async function createAuctionLot(data: Record<string, unknown>) {
  return request<{ success: boolean; id: string }>('/auction-lots', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAuctionLot(id: string, data: Record<string, unknown>) {
  return request<{ success: boolean }>(`/auction-lots/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getPayouts(filters?: { status?: string; contractId?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.contractId) params.set('contractId', filters.contractId);
  const qs = params.toString() ? `?${params}` : '';
  return request<Payout[]>(`/payouts${qs}`);
}

export async function updatePayout(id: string, data: { status: PayoutStatus; notes?: string }) {
  return request<{ success: boolean }>(`/payouts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getContractTemplates(filters?: { active?: boolean }) {
  const params = new URLSearchParams();
  if (filters?.active) params.set('active', '1');
  const qs = params.toString() ? `?${params}` : '';
  return request<ContractTemplate[]>(`/contract-templates${qs}`);
}

export async function getContractTemplate(id: string) {
  return request<ContractTemplate>(`/contract-templates/${id}`);
}

export async function createContractTemplate(data: Record<string, unknown>) {
  return request<{ success: boolean; id: string }>('/contract-templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateContractTemplate(id: string, data: Record<string, unknown>) {
  return request<{ success: boolean }>(`/contract-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

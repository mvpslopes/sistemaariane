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

export interface UserPermissions {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
  canViewAudit: boolean;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  name: string;
  avatarUrl?: string | null;
  role: Role;
  clientId: string | null;
  isAssessor?: boolean;
  isBuyer?: boolean;
  isSeller?: boolean;
  active?: boolean;
  mustChangePassword?: boolean;
  permissions?: UserPermissions;
}

export interface AuditLogEntry {
  id: string;
  createdAt: string;
  userId: string | null;
  username: string | null;
  role: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  summary: string | null;
  ip: string | null;
  userAgent?: string | null;
  success: boolean;
  meta?: Record<string, unknown> | null;
}

export interface AuditLogsResponse {
  items: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
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
  subscription_type?: 'assessoria' | 'avulso';
  subscription_suspended?: boolean;
  adhesion_fee?: number | null;
  monthly_fee?: number | null;
  adhesion_paid_at?: string | null;
  modules?: ClientModule[];
  created_at?: string;
}

export type ClientModuleCode =
  | 'plantel'
  | 'reproducao'
  | 'sanitario'
  | 'contratos'
  | 'leiloes'
  | 'estoque'
  | 'hospedagem'
  | 'financeiro_haras';

export interface ClientModule {
  code: ClientModuleCode;
  active: boolean;
  monthlyFee: number | null;
  activatedAt: string | null;
  notes: string | null;
}

export interface ClientSubscriptionPayload {
  subscriptionType: 'assessoria' | 'avulso';
  subscriptionSuspended: boolean;
  adhesionFee: number | null;
  monthlyFee: number | null;
  adhesionPaidAt: string | null;
  modules: Array<{ code: ClientModuleCode; active: boolean; monthlyFee: number | null }>;
}

export interface ReceivablesDashboard {
  openTotal: number;
  overdueTotal: number;
  openCount: number;
  overdueCount: number;
  aging: {
    current: number;
    d1_30: number;
    d31_60: number;
    d61_90: number;
    d90_plus: number;
  };
  byCollector: Record<
    'assessoria' | 'seller',
    { open: number; overdue: number; overdueCount: number }
  >;
  topDebtors: Array<{
    clientId: string;
    clientName: string;
    whatsapp: string | null;
    phone: string | null;
    chargesCount: number;
    overdueAmount: number;
    oldestDue: string | null;
  }>;
  overdueItems: Array<{
    id: string;
    amount: number;
    dueDate: string;
    status: string;
    collector: string;
    installmentNo: number;
    clientName: string;
    whatsapp: string | null;
    animalName: string | null;
    contractNumber: string | null;
    daysOverdue: number;
  }>;
}

export type ReceivablesAnalyticalStatus =
  | 'overdue_and_upcoming'
  | 'overdue'
  | 'upcoming'
  | 'cancelled'
  | 'paid'
  | 'all';

export type CollectionOutcome = 'sent' | 'answered' | 'no_answer' | 'promised' | 'paid' | 'other';
export type CollectionChannel = 'whatsapp' | 'phone' | 'email' | 'other';

export interface ChargeCollectionEvent {
  id: string;
  chargeId: string;
  userId: string | null;
  userName: string | null;
  note: string;
  outcome: CollectionOutcome;
  promisedDate: string | null;
  channel: CollectionChannel;
  createdAt: string;
}

export interface ReceivablesAnalyticalItem {
  id: string;
  installmentNo: number;
  installments: number;
  description: string;
  animalName: string | null;
  contractNumber: string | null;
  contractStatus: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  daysOverdue: number;
  status: string;
  collector: ChargeCollector;
  paymentMethod: string;
  paidAt: string | null;
  notes: string | null;
  collectionCount: number;
}

export interface ReceivablesAnalyticalClient {
  clientId: string;
  clientName: string;
  document: string | null;
  documentType: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  originalTotal: number;
  paidTotal: number;
  openTotal: number;
  items: ReceivablesAnalyticalItem[];
}

export interface ReceivablesAnalyticalReport {
  summary: {
    originalTotal: number;
    paidTotal: number;
    openTotal: number;
    itemCount: number;
    clientCount: number;
  };
  clients: ReceivablesAnalyticalClient[];
  historyAvailable: boolean;
}

export interface CompanyFinanceSummary {
  assessoria: {
    paidMonth: number;
    paidYear: number;
    open: number;
    overdue: number;
  };
  auctions: {
    revenue: number;
    expenses: number;
    commissionEstimated: number;
    resultEstimated: number;
  };
  payoutsPending: number;
  saas: {
    monthlyEstimated: number;
    activeClients: number;
  };
  monthlySeries: Array<{ label: string; assessoriaPaid: number }>;
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
export type ContractStatus =
  | 'rascunho'
  | 'pendente_envio'
  | 'aguardando_assinatura'
  | 'ativo'
  | 'concluido'
  | 'cancelado';
export type ChargeStatus = 'pendente' | 'pago' | 'atrasado' | 'cancelado';
export type ChargeCollector = 'assessoria' | 'seller';
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
  clicksign_signed_count?: number | null;
  clicksign_total_count?: number | null;
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
  contracts_count?: number | null;
  sales_total?: number | null;
  commission_estimated?: number | null;
  created_at?: string;
  lots?: AuctionLot[];
}

export interface AssessorAuctionFinanceContract {
  id: string;
  contract_number: string | null;
  animal_name: string | null;
  buyer_name: string | null;
  lot_number: string | null;
  total_amount: number;
  status: Contract['status'];
  commission_pct: number;
  commission_amount: number;
}

export interface AssessorAuctionPayout {
  id: string;
  contract_id: string;
  installment_no: number;
  amount: number;
  status: PayoutStatus;
  paid_at: string | null;
  charge_due_date: string | null;
  animal_name: string | null;
}

export interface AssessorAuctionFinance {
  auction_id: string;
  auction_name: string;
  auction_date: string | null;
  location: string | null;
  auction_status: AuctionStatus;
  contracts_count: number;
  sales_total: number;
  commission_estimated: number;
  commission_paid: number;
  commission_pending: number;
  commission_waiting: number;
  contracts: AssessorAuctionFinanceContract[];
  payouts: AssessorAuctionPayout[];
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

export type AuctionExpenseCategory =
  | 'locacao'
  | 'equipe'
  | 'marketing'
  | 'leiloeiro'
  | 'transporte'
  | 'outros';

export interface AuctionExpense {
  id: string;
  auction_id: string;
  category: AuctionExpenseCategory;
  description: string | null;
  amount: number;
  expense_date: string | null;
  created_at?: string;
}

export interface AuctionFinanceContract {
  id: string;
  contract_number: string | null;
  animal_name: string | null;
  buyer_name: string | null;
  lot_number: string | null;
  total_amount: number;
  status: Contract['status'];
  assessoria_pct: number;
  assessoria_amount: number;
}

export interface AuctionFinance {
  auction_id: string;
  lots_total: number;
  lots_sold: number;
  revenue_total: number;
  revenue_by_status: Record<string, number>;
  assessoria_estimated: number;
  expenses_total: number;
  expenses_by_category: Record<string, number>;
  result_net: number;
  contracts: AuctionFinanceContract[];
  expenses: AuctionExpense[];
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
  collector?: ChargeCollector;
  status: ChargeStatus;
  paid_at: string | null;
  notes: string | null;
  assessoria_commission_amount?: number | null;
  assessoria_commission_status?: string | null;
  assessoria_payout_id?: string | null;
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
  sire_name?: string | null;
  dam_name?: string | null;
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
  overdueAmount?: number;
  assessoriaPaidMonth?: number;
  auctionsOpen?: number;
  subscriptionsSuspended?: number;
  chargesDueSoon?: number;
  coveringsPending?: number;
}

export interface SearchResultItem {
  id: string;
  name: string;
  subtitle: string;
  to: string;
}

export interface GlobalSearchResults {
  people: SearchResultItem[];
  animals: SearchResultItem[];
  contracts: SearchResultItem[];
  auctions: SearchResultItem[];
}

export type BreedingMethod = 'ia' | 'monta_natural' | 'te';
export type AbccmmStatus = 'pendente' | 'comunicado' | 'confirmado';
export type EmbryoTransferStatus = 'pendente' | 'transferido' | 'em_gestacao' | 'nao_prenhe';
export type BirthStatus = 'previsto' | 'nascido' | 'aborto' | 'nao_prenhe';

export interface BreedingCovering {
  id: string;
  mareAnimalId: string;
  mareName: string | null;
  stallionAnimalId: string | null;
  stallionName: string | null;
  method: BreedingMethod;
  coveringDate: string;
  season: string | null;
  veterinarian: string | null;
  abccmmStatus: AbccmmStatus;
  associationProtocol: string | null;
  expectedDueDate: string | null;
  expectedDueStart: string | null;
  expectedDueEnd: string | null;
  recipientAnimalId: string | null;
  recipientName: string | null;
  embryoTransferDate: string | null;
  embryoTransferStatus: EmbryoTransferStatus | null;
  embryoTransferNotes: string | null;
  proceduresNotes: string | null;
  labExamsNotes: string | null;
  birthDate: string | null;
  birthStatus: BirthStatus | null;
  birthNotes: string | null;
  notes: string | null;
  createdAt?: string | null;
}

export interface BreedingCoveringInput {
  mareAnimalId: string;
  stallionAnimalId?: string | null;
  stallionName?: string | null;
  method: BreedingMethod;
  coveringDate: string;
  season?: string | null;
  veterinarian?: string | null;
  abccmmStatus?: AbccmmStatus;
  associationProtocol?: string | null;
  expectedDueDate?: string | null;
  recipientAnimalId?: string | null;
  embryoTransferDate?: string | null;
  embryoTransferStatus?: EmbryoTransferStatus | null;
  embryoTransferNotes?: string | null;
  proceduresNotes?: string | null;
  labExamsNotes?: string | null;
  birthDate?: string | null;
  birthStatus?: BirthStatus | null;
  birthNotes?: string | null;
  notes?: string | null;
}

export interface MyModulesPayload {
  subscriptionType: 'assessoria' | 'avulso';
  subscriptionSuspended: boolean;
  modules: ClientModule[];
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

export async function globalSearch(q: string) {
  const qs = new URLSearchParams({ q });
  return request<GlobalSearchResults>(`/search?${qs}`);
}

export async function getMyModules() {
  return request<MyModulesPayload>('/me/modules');
}

export async function getBreedingCoverings(q?: string) {
  const qs = q ? `?${new URLSearchParams({ q })}` : '';
  return request<BreedingCovering[]>(`/breeding-coverings${qs}`);
}

export async function createBreedingCovering(data: BreedingCoveringInput) {
  return request<{ success: boolean; id: string }>('/breeding-coverings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateBreedingCovering(id: string, data: Partial<BreedingCoveringInput>) {
  return request<{ success: boolean }>(`/breeding-coverings/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteBreedingCovering(id: string) {
  return request<{ success: boolean }>(`/breeding-coverings/${id}`, { method: 'DELETE' });
}

export interface HarasPropertyOption {
  id: string;
  clientId: string;
  name: string;
  city?: string | null;
  state?: string | null;
  isPrimary: boolean;
  propertyType?: string | null;
  ownerName?: string | null;
}

export async function getHarasProperties() {
  return request<HarasPropertyOption[]>('/haras-properties');
}

export interface HarasVetRecord {
  id: string;
  propertyId?: string | null;
  propertyName?: string | null;
  propertyOwnerName?: string | null;
  animalId: string;
  animalName?: string | null;
  recordType: 'vacina' | 'vermifugo' | 'exame' | 'tratamento' | 'outro';
  title: string;
  product?: string | null;
  recordDate: string;
  nextDueDate?: string | null;
  veterinarian?: string | null;
  resultNotes?: string | null;
  cost?: number | null;
  notes?: string | null;
}

export type HarasVetInput = Omit<HarasVetRecord, 'id' | 'animalName' | 'propertyName' | 'propertyOwnerName'>;

export async function getHarasVetRecords(filters?: { q?: string; type?: string; animalId?: string; propertyId?: string }) {
  const params = new URLSearchParams();
  if (filters?.q) params.set('q', filters.q);
  if (filters?.type) params.set('type', filters.type);
  if (filters?.animalId) params.set('animalId', filters.animalId);
  if (filters?.propertyId) params.set('propertyId', filters.propertyId);
  const qs = params.toString() ? `?${params}` : '';
  return request<HarasVetRecord[]>(`/haras-vet${qs}`);
}

export async function createHarasVetRecord(data: HarasVetInput) {
  return request<{ success: boolean; id: string }>('/haras-vet', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateHarasVetRecord(id: string, data: Partial<HarasVetInput>) {
  return request<{ success: boolean }>(`/haras-vet/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteHarasVetRecord(id: string) {
  return request<{ success: boolean }>(`/haras-vet/${id}`, { method: 'DELETE' });
}

export interface HarasStockItem {
  id: string;
  propertyId?: string | null;
  propertyName?: string | null;
  propertyOwnerName?: string | null;
  name: string;
  category: 'medicamento' | 'insumo' | 'racao' | 'material' | 'outro';
  unit: string;
  quantity: number;
  minQuantity: number;
  unitCost?: number | null;
  location?: string | null;
  notes?: string | null;
  lowStock: boolean;
}

export interface HarasStockMove {
  id: string;
  itemId: string;
  itemName?: string | null;
  moveType: 'entrada' | 'saida' | 'ajuste';
  quantity: number;
  reason?: string | null;
  animalId?: string | null;
  animalName?: string | null;
  createdAt?: string | null;
}

export async function getHarasStock(filters?: { q?: string; category?: string; propertyId?: string }) {
  const params = new URLSearchParams();
  if (filters?.q) params.set('q', filters.q);
  if (filters?.category) params.set('category', filters.category);
  if (filters?.propertyId) params.set('propertyId', filters.propertyId);
  const qs = params.toString() ? `?${params}` : '';
  return request<HarasStockItem[]>(`/haras-stock${qs}`);
}

export async function createHarasStockItem(data: Omit<HarasStockItem, 'id' | 'lowStock' | 'propertyName' | 'propertyOwnerName'>) {
  return request<{ success: boolean; id: string }>('/haras-stock', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateHarasStockItem(id: string, data: Partial<Omit<HarasStockItem, 'id' | 'lowStock' | 'quantity' | 'propertyName' | 'propertyOwnerName'>>) {
  return request<{ success: boolean }>(`/haras-stock/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteHarasStockItem(id: string) {
  return request<{ success: boolean }>(`/haras-stock/${id}`, { method: 'DELETE' });
}

export async function moveHarasStock(
  id: string,
  data: { moveType: 'entrada' | 'saida' | 'ajuste'; quantity: number; reason?: string; animalId?: string }
) {
  return request<{ success: boolean; quantity: number }>(`/haras-stock/${id}/move`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getHarasStockMoves(id: string) {
  return request<HarasStockMove[]>(`/haras-stock/${id}/moves`);
}

export interface HarasStay {
  id: string;
  propertyId?: string | null;
  propertyName?: string | null;
  propertyOwnerName?: string | null;
  animalId: string;
  animalName?: string | null;
  ownerClientId?: string | null;
  ownerName?: string | null;
  stall?: string | null;
  checkIn: string;
  checkOut?: string | null;
  dailyRate: number;
  status: 'hospedado' | 'encerrado';
  notes?: string | null;
  days: number;
  estimatedTotal: number;
}

export type HarasStayInput = {
  propertyId: string;
  animalId: string;
  ownerClientId?: string | null;
  stall?: string | null;
  checkIn: string;
  checkOut?: string | null;
  dailyRate: number;
  status?: 'hospedado' | 'encerrado';
  notes?: string | null;
};

export async function getHarasStays(filters?: { q?: string; status?: string; animalId?: string; propertyId?: string }) {
  const params = new URLSearchParams();
  if (filters?.q) params.set('q', filters.q);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.animalId) params.set('animalId', filters.animalId);
  if (filters?.propertyId) params.set('propertyId', filters.propertyId);
  const qs = params.toString() ? `?${params}` : '';
  return request<HarasStay[]>(`/haras-stays${qs}`);
}

export async function createHarasStay(data: HarasStayInput) {
  return request<{ success: boolean; id: string }>('/haras-stays', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateHarasStay(id: string, data: Partial<HarasStayInput>) {
  return request<{ success: boolean }>(`/haras-stays/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteHarasStay(id: string) {
  return request<{ success: boolean }>(`/haras-stays/${id}`, { method: 'DELETE' });
}

export interface HarasFinanceEntry {
  id: string;
  propertyId?: string | null;
  propertyName?: string | null;
  propertyOwnerName?: string | null;
  entryType: 'receita' | 'despesa';
  category: string;
  amount: number;
  entryDate: string;
  description: string;
  animalId?: string | null;
  animalName?: string | null;
  stayId?: string | null;
  notes?: string | null;
}

export interface HarasFinanceList {
  items: HarasFinanceEntry[];
  totals: { income: number; expense: number; balance: number };
}

export async function getHarasFinance(filters?: { q?: string; type?: string; from?: string; to?: string; propertyId?: string }) {
  const params = new URLSearchParams();
  if (filters?.q) params.set('q', filters.q);
  if (filters?.type) params.set('type', filters.type);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  if (filters?.propertyId) params.set('propertyId', filters.propertyId);
  const qs = params.toString() ? `?${params}` : '';
  return request<HarasFinanceList>(`/haras-finance${qs}`);
}

export async function createHarasFinance(data: Omit<HarasFinanceEntry, 'id' | 'animalName' | 'propertyName' | 'propertyOwnerName'>) {
  return request<{ success: boolean; id: string }>('/haras-finance', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateHarasFinance(id: string, data: Partial<Omit<HarasFinanceEntry, 'id' | 'animalName' | 'propertyName' | 'propertyOwnerName'>>) {
  return request<{ success: boolean }>(`/haras-finance/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteHarasFinance(id: string) {
  return request<{ success: boolean }>(`/haras-finance/${id}`, { method: 'DELETE' });
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
function normalizeMediaPath(path: string): string {
  const trimmed = path.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/uploads/')) return trimmed;
  if (trimmed.startsWith('uploads/')) return `/${trimmed}`;

  const bare = trimmed.replace(/^\/+/, '');
  if (/^avatar_\d{14}_[a-f0-9]+\.(jpe?g|png|webp|gif)$/i.test(bare)) {
    return `/uploads/avatars/${bare}`;
  }
  if (/^animal_\d{14}_[a-f0-9]+\.(jpe?g|png|webp|gif)$/i.test(bare)) {
    return `/uploads/animals/${bare}`;
  }
  if (/^person_\d{14}_[a-f0-9]+\.(jpe?g|png|webp|gif|pdf)$/i.test(bare)) {
    return `/uploads/persons/${bare}`;
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function mediaUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = normalizeMediaPath(path);
  const origin = API_URL.includes('api.php')
    ? API_URL.replace(/\/api\.php.*$/i, '')
    : API_URL.replace(/\/api\/?$/i, '');
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

export async function uploadAvatar(file: File) {
  return uploadMedia(file, 'avatar');
}

async function uploadMedia(file: File, kind: 'animal' | 'person-doc' | 'avatar') {
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

export async function deleteUser(id: string) {
  return request<{ success: boolean; message?: string }>(`/users/${id}`, {
    method: 'DELETE',
  });
}

export async function getContracts(filters?: { animalId?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.animalId) params.set('animalId', filters.animalId);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString() ? `?${params}` : '';
  return request<Contract[]>(`/contracts${qs}`);
}

export interface ContractSignatureProgressItem {
  contractId: string;
  signedCount: number;
  totalCount: number;
  pendingCount: number;
  status?: ContractStatus;
  clicksignStatus?: string | null;
}

export async function refreshContractsSignatureProgress(ids: string[], refresh = true) {
  return request<{ items: ContractSignatureProgressItem[] }>('/contracts/clicksign-progress', {
    method: 'POST',
    body: JSON.stringify({ ids, refresh }),
  });
}

export interface CollectionWhatsappSettings {
  template: string;
  bankDetails: string;
}

export async function getCollectionWhatsappSettings() {
  return request<CollectionWhatsappSettings>('/system-settings/collection-whatsapp');
}

export async function saveCollectionWhatsappSettings(data: CollectionWhatsappSettings) {
  return request<{ success: boolean } & CollectionWhatsappSettings>('/system-settings/collection-whatsapp', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
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
  partyRole?: string;
  label: string;
  name: string;
  email?: string | null;
  clicksignEmail?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  signerId?: string | null;
  signUrl?: string | null;
  signed: boolean;
  status: 'assinado' | 'pendente' | 'invalido' | string;
  statusLabel: string;
  signedAt?: string | null;
  needsResend?: boolean;
  emailDrift?: boolean;
  canUpdate?: boolean;
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
  emailDrift?: boolean;
  needsResend?: boolean;
}

export interface ClicksignEmailSyncResult {
  success: boolean;
  message: string;
  updated: Array<{
    label: string;
    partyRole?: string;
    from: string;
    to: string;
    oldSignerId?: string;
    newSignerId?: string;
    repaired?: boolean;
  }>;
  unchanged: Array<{ label: string; partyRole?: string; email: string }>;
  skipped: Array<{ label: string; partyRole?: string; reason: string }>;
  warnings: string[];
  tracking?: ClicksignTracking;
}

export interface ClicksignSignerResolve {
  success: boolean;
  signerKey: string;
  replaced: boolean;
  contractId?: string;
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

export async function syncClicksignEmails(id: string, partyRole?: string | null) {
  return request<ClicksignEmailSyncResult>(`/contracts/${id}/clicksign/sync-emails`, {
    method: 'POST',
    body: JSON.stringify(partyRole ? { partyRole } : {}),
  });
}

/** Valida ou redireciona link de assinatura (público, sem login). */
export async function resolveClicksignSignerKey(key: string) {
  const apiBase = (import.meta.env.VITE_API_URL as string) || '/api.php';
  const url = `${apiBase.replace(/\/$/, '')}/clicksign-signer/${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Link de assinatura inválido');
  }
  return data as ClicksignSignerResolve;
}

export async function getCharges(filters?: {
  status?: string;
  contractId?: string;
  clientId?: string;
  collector?: ChargeCollector;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.contractId) params.set('contractId', filters.contractId);
  if (filters?.clientId) params.set('clientId', filters.clientId);
  if (filters?.collector) params.set('collector', filters.collector);
  const qs = params.toString() ? `?${params}` : '';
  return request<Charge[]>(`/charges${qs}`);
}

export async function updateCharge(
  id: string,
  data: { status?: ChargeStatus; collector?: ChargeCollector; notes?: string }
) {
  return request<{ success: boolean }>(`/charges/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function bulkUpdateCharges(data: {
  clientId: string;
  collector: ChargeCollector;
  onlyAssessoria?: boolean;
  onlyOpen?: boolean;
  notes?: string;
}) {
  return request<{ success: boolean; updated: number }>('/charges/bulk-update', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function registerChargeCommission(
  id: string,
  data: { amount: number; notes?: string; markChargePaid?: boolean }
) {
  return request<{ success: boolean }>(`/charges/${id}/register-commission`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getAuditLogs(filters?: {
  userId?: string;
  action?: string;
  resource?: string;
  from?: string;
  to?: string;
  q?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.userId) params.set('userId', filters.userId);
  if (filters?.action) params.set('action', filters.action);
  if (filters?.resource) params.set('resource', filters.resource);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  if (filters?.q) params.set('q', filters.q);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  const qs = params.toString() ? `?${params}` : '';
  return request<AuditLogsResponse>(`/audit-logs${qs}`);
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

export async function getAssessorAuctionFinance(auctionId: string) {
  return request<AssessorAuctionFinance>(`/auctions/${auctionId}/assessor-finance`);
}

export async function getAuctionFinance(auctionId: string) {
  return request<AuctionFinance>(`/auctions/${auctionId}/finance`);
}

export async function createAuctionExpense(
  auctionId: string,
  data: {
    category: AuctionExpenseCategory;
    description?: string;
    amount: number;
    expenseDate?: string;
  }
) {
  return request<{ success: boolean; id: string }>(`/auctions/${auctionId}/expenses`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAuctionExpense(
  auctionId: string,
  expenseId: string,
  data: Partial<{
    category: AuctionExpenseCategory;
    description: string;
    amount: number;
    expenseDate: string | null;
  }>
) {
  return request<{ success: boolean }>(`/auctions/${auctionId}/expenses/${expenseId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteAuctionExpense(auctionId: string, expenseId: string) {
  return request<{ success: boolean }>(`/auctions/${auctionId}/expenses/${expenseId}`, {
    method: 'DELETE',
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

export async function reversePayout(id: string, notes?: string) {
  return request<{ success: boolean; status: PayoutStatus }>(`/payouts/${id}/reverse`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
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

export async function getReceivablesDashboard() {
  return request<ReceivablesDashboard>('/receivables-dashboard');
}

export async function getReceivablesAnalytical(filters?: {
  status?: ReceivablesAnalyticalStatus;
  from?: string;
  to?: string;
  clientId?: string;
  q?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  if (filters?.clientId) params.set('clientId', filters.clientId);
  if (filters?.q) params.set('q', filters.q);
  const qs = params.toString() ? `?${params}` : '';
  return request<ReceivablesAnalyticalReport>(`/receivables-analytical${qs}`);
}

export async function getChargeCollectionEvents(chargeId: string) {
  return request<ChargeCollectionEvent[]>(`/charges/${chargeId}/collection-events`);
}

export async function createChargeCollectionEvent(
  chargeId: string,
  data: {
    note: string;
    outcome?: CollectionOutcome;
    promisedDate?: string | null;
    channel?: CollectionChannel;
  }
) {
  return request<ChargeCollectionEvent>(`/charges/${chargeId}/collection-events`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getCompanyFinance() {
  return request<CompanyFinanceSummary>('/company-finance');
}

export async function getSubscriptions() {
  return request<Client[]>('/subscriptions');
}

export async function getClientModules(clientId: string) {
  return request<ClientSubscriptionPayload>(`/clients/${clientId}/modules`);
}

export async function updateClientModules(clientId: string, data: ClientSubscriptionPayload) {
  return request<{ success: boolean }>(`/clients/${clientId}/modules`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export interface DailyReportOcorrencias {
    clienteIrritado: boolean;
    cobrancaIndevida: boolean;
    questionamentoFinanceiro: boolean;
    contestacaoRegras: boolean;
    escaladoGestao: boolean;
    nenhumaCritica: boolean;
}

export interface DailyReportPayload {
  reportDate?: string;
  data?: string;
  colaboradora?: string;
  numAtendimentos: string;
  todosClientesRespondidos: boolean;
  clientesPendentes?: string;
  ocorrencias: DailyReportOcorrencias;
  suporteGestao: boolean;
  suporteColegas: boolean;
  motivoSuporte?: string;
  autoavaliacao: string;
  compromissosAmanha?: string;
  declaracao: boolean;
}

export interface DailyReportRecord extends DailyReportPayload {
  id: string;
  userId: string | null;
  dataLabel?: string;
  timestamp?: string | null;
  createdAt?: string | null;
}

export async function getDailyReports(filters?: {
  q?: string;
  userId?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.q) params.set('q', filters.q);
  if (filters?.userId) params.set('userId', filters.userId);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  if (filters?.limit) params.set('limit', String(filters.limit));
  const qs = params.toString() ? `?${params}` : '';
  return request<DailyReportRecord[]>(`/daily-reports${qs}`);
}

export async function getDailyReportTodayStatus() {
  return request<{ submitted: boolean; report: DailyReportRecord | null }>('/daily-reports/today');
}

export async function getDailyReport(id: string) {
  return request<DailyReportRecord>(`/daily-reports/${id}`);
}

export async function saveDailyReport(report: DailyReportPayload) {
  return request<{ success: boolean; id: string }>('/daily-reports', {
    method: 'POST',
    body: JSON.stringify(report),
  });
}

export async function deleteDailyReport(id: string) {
  return request<{ success: boolean }>(`/daily-reports/${id}`, { method: 'DELETE' });
}

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function askAssistant(payload: {
  messages: AssistantMessage[];
  context: string;
  userName?: string;
  userRole?: string;
}) {
  return request<{ reply: string }>('/ai-assistant', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface ChatUser {
  id: string;
  name: string;
  username: string;
  role: Role;
  avatarUrl?: string | null;
}

export interface ChatThread {
  id: string;
  peer: ChatUser;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderUserId: string;
  senderName: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

export async function getChatContacts(q?: string) {
  const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  return request<{ items: ChatUser[] }>(`/chat/contacts${qs}`);
}

export async function getChatUnreadCount() {
  return request<{ count: number }>('/chat/unread-count');
}

export async function getChatThreads() {
  return request<{ items: ChatThread[] }>('/chat/threads');
}

export async function openChatThread(userId: string) {
  return request<{ thread: ChatThread }>('/chat/threads', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export async function getChatMessages(threadId: string, before?: string) {
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  const qs = params.toString() ? `?${params}` : '';
  return request<{ items: ChatMessage[]; peer: ChatUser | null; peerLastReadAt: string | null }>(
    `/chat/threads/${threadId}/messages${qs}`
  );
}

export async function sendChatMessage(threadId: string, body: string) {
  return request<{ message: ChatMessage }>(`/chat/threads/${threadId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export async function markChatThreadRead(threadId: string) {
  return request<{ success: boolean }>(`/chat/threads/${threadId}/read`, {
    method: 'PUT',
  });
}

export interface OnlineUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  avatarUrl?: string | null;
  lastSeenAt: string;
}

export interface UserAccessLogEntry {
  id: string;
  userId: string;
  username: string;
  name: string;
  role: Role;
  avatarUrl?: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export async function sendPresenceHeartbeat() {
  return request<{ success: boolean }>('/presence/heartbeat', { method: 'POST' });
}

export async function getRootOnlineUsers(minutes = 5) {
  return request<{ items: OnlineUser[]; onlineMinutes: number }>(
    `/root/online?minutes=${minutes}`
  );
}

export async function getRootAccessLog(page = 1, limit = 50) {
  return request<{ items: UserAccessLogEntry[]; page: number; limit: number; total: number }>(
    `/root/access-log?page=${page}&limit=${limit}`
  );
}

export interface RootUsageMetrics {
  days: number;
  summary: {
    loginsToday: number;
    loginsWeek: number;
    uniqueUsers: number;
  };
  loginsByDay: Array<{ date: string; count: number }>;
  loginsByRole: Array<{ role: Role; count: number }>;
  activeUsersByRole: Array<{ role: Role; count: number }>;
  peakHours: Array<{ hour: number; count: number }>;
}

export async function getRootUsageMetrics(days = 30) {
  return request<RootUsageMetrics>(`/root/usage-metrics?days=${days}`);
}

export async function forceLogoutUser(userId: string) {
  return request<{ success: boolean }>(`/root/force-logout/${userId}`, { method: 'POST' });
}

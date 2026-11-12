import { getToken, setToken, clearToken } from "./auth-storage";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type MembershipStatus = "pending" | "approved" | "rejected" | "suspended" | null;

export interface Profile {
  id: string;
  email: string;
  condo_id: string | null;
  role: string;
  full_name: string | null;
  active: boolean;
  condo_name?: string | null;
  phone?: string | null;
  unit?: string | null;
  block?: string | null;
  membership_status: MembershipStatus;
  preferences?: Preferences;
  /** Falso em contas criadas pelo Google que ainda não definiram senha. */
  has_password?: boolean;
}

export interface Preferences {
  text_size?: "normal" | "large";
  reduced_motion?: boolean;
}

export interface CondoSummary {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
}

export interface Condo extends CondoSummary {
  identifier: string;
  created_at: string;
  doc_count?: number;
  resident_count?: number;
  pending_count?: number;
}

export interface Membership {
  status: MembershipStatus;
  unit: string | null;
  block: string | null;
  requested_at: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  terms_accepted: boolean;
  condo: CondoSummary | null;
}

export interface AccessRequest {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  unit: string | null;
  block: string | null;
  invite_code: string | null;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  decided_at: string | null;
  decision_reason: string | null;
  condo_id: string;
  condo_name: string;
}

export interface Resident {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  unit: string | null;
  block: string | null;
  role: string;
  active: boolean;
  membership_status: MembershipStatus;
  created_at: string;
  requested_at: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  member_since: string;
}

export interface ResidentDetail extends Resident {
  condo_id: string;
  condo_name: string;
  decided_by_name: string | null;
}

export interface MembershipEvent {
  id: string;
  type: string;
  payload: { reason?: string; unit?: string; block?: string | null };
  created_at: string;
  actor_name: string | null;
  by_self: boolean;
}

export type DocumentStatus = "uploaded" | "processing" | "processed" | "failed" | "needs_review";
export type DocumentCategory = "convencao" | "regimento" | "atas" | "comunicados" | "regulamentos" | "manuais" | "outros";

export interface CondoDocument {
  id: string;
  condo_id: string;
  filename: string;
  mime: string | null;
  size: number | null;
  category: DocumentCategory;
  description: string | null;
  status: DocumentStatus;
  active: boolean;
  page_count: number | null;
  chunk_count: number;
  error: string | null;
  has_file: boolean;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  uploaded_by_name: string | null;
  /** Presentes no detalhe. */
  condo_name?: string;
  summarized_count?: number;
  file_size?: number | null;
}

export interface DocumentUploadBody {
  filename: string;
  mime: string;
  size: number;
  pages: { page: number | null; text: string }[];
}

export interface ProcessResult {
  document: CondoDocument;
  processed: number;
  total: number;
}

export interface ChatSource {
  document_id: string;
  filename: string;
  page: number | null;
}

export type ChatOutcome = "answered" | "not_found" | "out_of_scope" | "error";

export interface ChatMessageRecord {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  outcome: ChatOutcome | null;
  intent: string | null;
  sources: ChatSource[];
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationSummary extends Conversation {
  message_count: number;
  has_sources: boolean;
}

export interface CitableDocument {
  id: string;
  filename: string;
  category: DocumentCategory;
  page_count: number | null;
  condo_name: string;
}

export type AgentIcon = "sparkles" | "building" | "message" | "bot" | "key" | "home";
export type AgentTone = "amigavel" | "formal" | "objetivo";
export type AgentLanguage = "pt-BR" | "en" | "es";
export type AgentStatus = "incomplete" | "ready" | "available";

/** O que o chat do morador precisa saber do assistente. */
export interface AgentPublic {
  name: string;
  greeting: string;
  suggestions: string[];
  avatar_icon: AgentIcon;
  enabled: boolean;
}

export interface AgentSettings extends AgentPublic {
  condo_id: string;
  condo_name: string;
  personality: string | null;
  tone: AgentTone;
  language: AgentLanguage;
  custom: { name: string | null; greeting: string | null; personality: string | null; suggestions: string[] };
  updated_at: string | null;
  updated_by_name: string | null;
}

export interface AgentReadiness {
  status: AgentStatus;
  enabled: boolean;
  counts: { available: number; processing: number; attention: number; inactive: number; total: number };
}

export interface AgentSettingsInput {
  name: string;
  greeting: string;
  personality: string;
  language: AgentLanguage;
  tone: AgentTone;
  suggestions: string[];
  avatar_icon: AgentIcon;
}

export interface FinancialRecord {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  type: string;
}

let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(cb: () => void) {
  onUnauthorized = cb;
}

/** Chamado quando o servidor recusa por falta de vínculo aprovado (ex.: acesso suspenso durante o uso). */
let onMembershipRequired: (() => void) | null = null;
export function setOnMembershipRequired(cb: () => void) {
  onMembershipRequired = cb;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    clearToken();
    onUnauthorized?.();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 403 && body.code === "membership_required") onMembershipRequired?.();
    throw new ApiError(body.error || `Erro ${res.status}`, res.status, body.code);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Requisição que devolve binário (ex.: arquivo original de um documento). */
async function requestBlob(path: string): Promise<Blob> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || `Erro ${res.status}`, res.status, body.code);
  }
  return res.blob();
}

const withCondo = (condoId?: string) => (condoId ? `?condo_id=${encodeURIComponent(condoId)}` : "");

export const api = {
  auth: {
    login: (data: { email: string; password: string }) =>
      request<{ token: string; user: Profile }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    signup: (data: { email: string; password: string; full_name: string; phone?: string; accept_terms: boolean }) =>
      request<{ token: string; user: Profile }>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    bootstrapSuperadmin: (data: { email: string; password: string; full_name: string }) =>
      request<{ token: string; user: Profile }>("/api/auth/bootstrap-superadmin", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    me: () => request<{ user: Profile }>("/api/auth/me"),
    forgotPassword: (email: string) =>
      request<{ success: boolean }>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
    resetPassword: (token: string, password: string) =>
      request<{ success: boolean }>("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }),
    googleUrl: () => `${API_URL}/api/auth/google`,
  },
  condos: {
    search: (q: string) => request<{ condos: CondoSummary[] }>(`/api/condos/search?q=${encodeURIComponent(q)}`),
    summary: (id: string) => request<{ condo: CondoSummary }>(`/api/condos/${encodeURIComponent(id)}/summary`),
    list: () => request<{ condos: Condo[] }>("/api/condos"),
    create: (data: { name: string; identifier: string; address?: string; city?: string; state?: string }) =>
      request<{ condo: Condo }>("/api/condos", { method: "POST", body: JSON.stringify(data) }),
  },
  membership: {
    get: () => request<{ membership: Membership }>("/api/me/membership"),
    request: (data: { condo_id: string; unit: string; block?: string; invite_code?: string; accept_terms?: boolean }) =>
      request<{ success: boolean }>("/api/me/membership-request", { method: "POST", body: JSON.stringify(data) }),
    cancel: () => request<{ success: boolean }>("/api/me/membership-request", { method: "DELETE" }),
  },
  accessRequests: {
    list: (status: "pending" | "approved" | "rejected" = "pending") =>
      request<{ requests: AccessRequest[] }>(`/api/access-requests?status=${status}`),
    approve: (id: string) => request<{ success: boolean }>(`/api/access-requests/${id}/approve`, { method: "POST" }),
    reject: (id: string, reason?: string) =>
      request<{ success: boolean }>(`/api/access-requests/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  },
  residents: {
    /** `condoId` só é usado pelo administrador da plataforma. */
    list: (condoId?: string) => request<{ residents: Resident[] }>(`/api/residents${withCondo(condoId)}`),
    get: (id: string) => request<{ resident: ResidentDetail; events: MembershipEvent[] }>(`/api/residents/${id}`),
    create: (data: { email: string; password: string; full_name: string; unit: string; block?: string; condo_id?: string }) =>
      request<{ success: boolean; user_id: string }>("/api/residents", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    suspend: (id: string, reason?: string) =>
      request<{ resident: ResidentDetail }>(`/api/residents/${id}/suspend`, { method: "POST", body: JSON.stringify({ reason }) }),
    reactivate: (id: string) => request<{ resident: ResidentDetail }>(`/api/residents/${id}/reactivate`, { method: "POST" }),
    remove: (id: string, reason?: string) =>
      request<{ resident: null }>(`/api/residents/${id}/remove`, { method: "POST", body: JSON.stringify({ reason }) }),
  },
  admins: {
    create: (data: { email: string; password: string; full_name: string; condo_id: string }) =>
      request<{ success: boolean; user_id: string }>("/api/admins", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  financial: {
    list: (params: { page: number; pageSize: number; category?: string }) =>
      request<{ records: FinancialRecord[]; total: number }>(
        `/api/financial-records?page=${params.page}&pageSize=${params.pageSize}${
          params.category ? `&category=${encodeURIComponent(params.category)}` : ""
        }`
      ),
    categories: () => request<{ categories: string[] }>("/api/financial-records/categories"),
    bulkInsert: (records: unknown[]) =>
      request<{ success: boolean; count: number }>("/api/financial-records/bulk", {
        method: "POST",
        body: JSON.stringify({ records }),
      }),
  },
  documents: {
    /** `condoId` só é usado pelo administrador da plataforma; o admin do condomínio fica no próprio. */
    list: (condoId?: string) => request<{ documents: CondoDocument[] }>(`/api/documents${withCondo(condoId)}`),
    get: (id: string) => request<{ document: CondoDocument }>(`/api/documents/${id}`),
    create: (data: DocumentUploadBody & { category: DocumentCategory; description?: string; condo_id?: string }) =>
      request<{ document: CondoDocument }>("/api/documents", { method: "POST", body: JSON.stringify(data) }),
    replace: (id: string, data: DocumentUploadBody) =>
      request<{ document: CondoDocument }>(`/api/documents/${id}/replace`, { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Pick<CondoDocument, "category" | "description" | "active">>) =>
      request<{ document: CondoDocument }>(`/api/documents/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/api/documents/${id}`, { method: "DELETE" }),
    process: (id: string, force = false) =>
      request<ProcessResult>(`/api/documents/${id}/process`, { method: "POST", body: JSON.stringify({ force }) }),
    uploadFile: (id: string, file: File, mime: string) =>
      request<{ document: CondoDocument }>(`/api/documents/${id}/file`, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": mime },
      }),
    downloadFile: (id: string) => requestBlob(`/api/documents/${id}/file`),
    /** Documento citado como fonte (o morador só vê os processados e ativos do próprio condomínio). */
    source: (id: string) => request<{ document: CitableDocument }>(`/api/documents/${id}/source`),
    page: (id: string, page: number) =>
      request<{ document: { id: string; filename: string; page_count: number }; page: number; content: string }>(
        `/api/documents/${id}/pages/${page}`
      ),
  },
  chat: {
    /** Sem `conversationId`, o servidor abre uma conversa nova. */
    ask: (question: string, conversationId?: string) =>
      request<{ conversation: Conversation; user_message: ChatMessageRecord; assistant_message: ChatMessageRecord }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ question, conversation_id: conversationId }),
      }),
    retry: (messageId: string) =>
      request<{ assistant_message: ChatMessageRecord }>(`/api/chat/messages/${messageId}/retry`, { method: "POST" }),
  },
  agent: {
    get: (condoId?: string) => request<{ agent: AgentPublic }>(`/api/agent${withCondo(condoId)}`),
    settings: (condoId?: string) =>
      request<{ settings: AgentSettings; readiness: AgentReadiness }>(`/api/agent/settings${withCondo(condoId)}`),
    update: (data: AgentSettingsInput, condoId?: string) =>
      request<{ settings: AgentSettings; readiness: AgentReadiness }>("/api/agent/settings", {
        method: "PUT",
        body: JSON.stringify({ ...data, condo_id: condoId }),
      }),
    setAvailability: (enabled: boolean, condoId?: string) =>
      request<{ settings: AgentSettings; readiness: AgentReadiness }>("/api/agent/availability", {
        method: "PUT",
        body: JSON.stringify({ enabled, condo_id: condoId }),
      }),
    test: (question: string, opts: { condoId?: string; draft?: AgentSettingsInput } = {}) =>
      request<{ answer: { content: string; outcome: ChatOutcome; intent: string | null; sources: ChatSource[] } }>("/api/agent/test", {
        method: "POST",
        body: JSON.stringify({ question, condo_id: opts.condoId, draft: opts.draft }),
      }),
  },
  conversations: {
    list: (q = "") => request<{ conversations: ConversationSummary[] }>(`/api/conversations${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    get: (id: string) => request<{ conversation: Conversation; messages: ChatMessageRecord[] }>(`/api/conversations/${id}`),
    remove: (id: string) => request<void>(`/api/conversations/${id}`, { method: "DELETE" }),
    removeAll: () => request<{ deleted: number }>("/api/conversations", { method: "DELETE" }),
  },
  me: {
    update: (data: { full_name?: string; phone?: string }) =>
      request<{ user: Profile }>("/api/me", { method: "PATCH", body: JSON.stringify(data) }),
    changePassword: (data: { current_password?: string; new_password: string }) =>
      request<{ success: boolean }>("/api/me/password", { method: "POST", body: JSON.stringify(data) }),
    updatePreferences: (prefs: Preferences) =>
      request<{ user: Profile }>("/api/me/preferences", { method: "PATCH", body: JSON.stringify(prefs) }),
  },
};

export { setToken, clearToken, getToken };

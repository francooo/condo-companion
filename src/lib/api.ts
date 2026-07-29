import { getToken, setToken, clearToken } from "./auth-storage";

const API_URL = import.meta.env.VITE_API_URL as string;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface Profile {
  id: string;
  email: string;
  condo_id: string | null;
  role: string;
  full_name: string | null;
  active: boolean;
  condo_name?: string | null;
}

export interface Condo {
  id: string;
  name: string;
  identifier: string;
  created_at: string;
  doc_count?: number;
}

export interface Resident {
  id: string;
  full_name: string | null;
  role: string;
  active: boolean;
  created_at: string;
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
    throw new ApiError(body.error || `Erro ${res.status}`, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  auth: {
    login: (data: { email: string; password: string; condo_identifier?: string }) =>
      request<{ token: string; user: Profile }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    signup: (data: { email: string; password: string; full_name: string; condo_identifier: string }) =>
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
    googleUrl: (condoIdentifier?: string) =>
      `${API_URL}/api/auth/google${condoIdentifier ? `?condo_identifier=${encodeURIComponent(condoIdentifier)}` : ""}`,
  },
  condos: {
    lookup: (identifier: string) =>
      request<{ condo: { id: string; name: string } }>(`/api/condos/lookup?identifier=${encodeURIComponent(identifier)}`),
    list: () => request<{ condos: Condo[] }>("/api/condos"),
    create: (data: { name: string; identifier: string }) =>
      request<{ condo: Condo }>("/api/condos", { method: "POST", body: JSON.stringify(data) }),
  },
  me: {
    linkCondo: (identifier: string) =>
      request<{ success: boolean; condo: { id: string; name: string } }>("/api/me/condo", {
        method: "POST",
        body: JSON.stringify({ identifier }),
      }),
  },
  residents: {
    list: () => request<{ residents: Resident[] }>("/api/residents"),
    create: (data: { email: string; password: string; full_name: string; condo_id?: string }) =>
      request<{ success: boolean; user_id: string }>("/api/residents", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    setActive: (id: string, active: boolean) =>
      request<{ success: boolean }>(`/api/residents/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      }),
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
  knowledgeBase: {
    upload: (data: { text: string; filename: string; condo_id?: string }) =>
      request<{ success: boolean; count: number }>("/api/documents", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  chat: {
    ask: (question: string) =>
      request<{ answer: string; intent: string }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ question }),
      }),
  },
};

export { setToken, clearToken, getToken };

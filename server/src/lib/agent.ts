import { query } from "../db.js";

export const AGENT_LANGUAGES = ["pt-BR", "en", "es"] as const;
export const AGENT_TONES = ["amigavel", "formal", "objetivo"] as const;
export const AGENT_ICONS = ["sparkles", "building", "message", "bot", "key", "home"] as const;
export type AgentLanguage = (typeof AGENT_LANGUAGES)[number];
export type AgentTone = (typeof AGENT_TONES)[number];
export type AgentIcon = (typeof AGENT_ICONS)[number];

export const MAX_SUGGESTIONS = 6;

export const DEFAULT_SUGGESTIONS = [
  "Quais são as regras do condomínio?",
  "Como reservar o salão de festas?",
  "Qual é o horário permitido para obras?",
  "Posso receber visitantes?",
  "Onde encontro os comunicados?",
  "Quais são as regras para animais de estimação?",
];

/** O que define como o assistente fala. */
export interface AgentPersona {
  name: string;
  personality: string | null;
  tone: AgentTone;
  language: AgentLanguage;
}

/** Configuração completa, já com os padrões aplicados. */
export interface AgentSettings extends AgentPersona {
  condo_id: string;
  condo_name: string;
  greeting: string;
  suggestions: string[];
  avatar_icon: AgentIcon;
  enabled: boolean;
  /** Valores gravados (null quando o padrão está em uso), para o formulário. */
  custom: { name: string | null; greeting: string | null; personality: string | null; suggestions: string[] };
  updated_at: string | null;
  updated_by_name: string | null;
}

export const defaultName = (condoName: string) => `Assistente ${condoName}`;
export const DEFAULT_GREETING = "Posso ajudar a encontrar informações nos documentos deste condomínio.";

const TONE_TEXT: Record<AgentTone, string> = {
  amigavel: "Use um tom amigável e acolhedor, sem perder a precisão.",
  formal: "Use um tom formal e cordial, adequado a uma comunicação oficial do condomínio.",
  objetivo: "Seja objetivo: vá direto ao ponto, com frases curtas e listas quando ajudar.",
};
const LANGUAGE_TEXT: Record<AgentLanguage, string> = {
  "pt-BR": "Responda em português do Brasil.",
  en: "Responda em inglês (English), mesmo que os documentos estejam em português.",
  es: "Responda em espanhol (español), mesmo que os documentos estejam em português.",
};

/** Instrução de sistema com a identidade do assistente; `task` descreve a tarefa da chamada. */
export function systemPrompt(persona: AgentPersona, task: string) {
  return [
    `Você é ${persona.name}, o assistente virtual de um condomínio.`,
    persona.personality ? `Personalidade: ${persona.personality}.` : null,
    TONE_TEXT[persona.tone],
    LANGUAGE_TEXT[persona.language],
    task,
    "Nunca invente regras, valores ou datas que não estejam nas informações fornecidas.",
  ]
    .filter(Boolean)
    .join(" ");
}

interface AgentRow {
  condo_id: string;
  condo_name: string;
  name: string | null;
  greeting: string | null;
  personality: string | null;
  language: AgentLanguage | null;
  tone: AgentTone | null;
  suggestions: string[] | null;
  avatar_icon: AgentIcon | null;
  enabled: boolean | null;
  updated_at: string | null;
  updated_by_name: string | null;
}

/** Configuração do agente do condomínio (padrões quando ainda não foi configurado). `null` se o condomínio não existe. */
export async function loadAgent(condoId: string): Promise<AgentSettings | null> {
  const { rows } = await query<AgentRow>(
    `SELECT c.id AS condo_id, c.name AS condo_name, a.name, a.greeting, a.personality, a.language, a.tone,
            a.suggestions, a.avatar_icon, a.enabled, a.updated_at, u.full_name AS updated_by_name
       FROM condos c
       LEFT JOIN agent_settings a ON a.condo_id = c.id
       LEFT JOIN users u ON u.id = a.updated_by
      WHERE c.id = $1`,
    [condoId]
  );
  const r = rows[0];
  if (!r) return null;
  const suggestions = r.suggestions?.length ? r.suggestions : DEFAULT_SUGGESTIONS;
  return {
    condo_id: r.condo_id,
    condo_name: r.condo_name,
    name: r.name || defaultName(r.condo_name),
    greeting: r.greeting || DEFAULT_GREETING,
    personality: r.personality,
    language: r.language ?? "pt-BR",
    tone: r.tone ?? "amigavel",
    suggestions,
    avatar_icon: r.avatar_icon ?? "sparkles",
    // Sem linha de configuração: condomínio novo, ainda não liberado aos moradores.
    enabled: r.enabled ?? false,
    custom: { name: r.name, greeting: r.greeting, personality: r.personality, suggestions: r.suggestions ?? [] },
    updated_at: r.updated_at,
    updated_by_name: r.updated_by_name,
  };
}

export type AgentStatus = "incomplete" | "ready" | "available";

export interface AgentReadiness {
  status: AgentStatus;
  enabled: boolean;
  counts: { available: number; processing: number; attention: number; inactive: number; total: number };
}

/**
 * - incomplete: nenhum documento processado e ativo (o assistente não teria o que consultar);
 * - ready: base pronta, mas ainda não liberado aos moradores;
 * - available: liberado aos moradores com base pronta.
 */
export function readinessFrom(enabled: boolean, counts: AgentReadiness["counts"]): AgentStatus {
  if (counts.available === 0) return "incomplete";
  return enabled ? "available" : "ready";
}

export async function loadReadiness(condoId: string, enabled: boolean): Promise<AgentReadiness> {
  const { rows } = await query<AgentReadiness["counts"]>(
    `SELECT COUNT(*) FILTER (WHERE status = 'processed' AND active)::int AS available,
            COUNT(*) FILTER (WHERE status IN ('uploaded', 'processing'))::int AS processing,
            COUNT(*) FILTER (WHERE status IN ('failed', 'needs_review'))::int AS attention,
            COUNT(*) FILTER (WHERE status = 'processed' AND NOT active)::int AS inactive,
            COUNT(*)::int AS total
       FROM documents WHERE condo_id = $1`,
    [condoId]
  );
  const counts = rows[0];
  return { status: readinessFrom(enabled, counts), enabled, counts };
}

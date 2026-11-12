import { Bot, Building2, Home, KeyRound, MessageCircle, Sparkles, type LucideIcon } from "lucide-react";
import type { AgentIcon, AgentLanguage, AgentSettings, AgentSettingsInput, AgentTone } from "./api";

export const AGENT_ICONS: { value: AgentIcon; label: string; icon: LucideIcon }[] = [
  { value: "sparkles", label: "Brilho", icon: Sparkles },
  { value: "building", label: "Prédio", icon: Building2 },
  { value: "home", label: "Casa", icon: Home },
  { value: "message", label: "Conversa", icon: MessageCircle },
  { value: "bot", label: "Robô", icon: Bot },
  { value: "key", label: "Chave", icon: KeyRound },
];

export const agentIcon = (value: AgentIcon | undefined): LucideIcon => AGENT_ICONS.find((i) => i.value === value)?.icon ?? Sparkles;

export const AGENT_TONES: { value: AgentTone; label: string; hint: string }[] = [
  { value: "amigavel", label: "Amigável", hint: "Acolhedor, sem perder a precisão." },
  { value: "formal", label: "Formal", hint: "Cordial, como um comunicado oficial." },
  { value: "objetivo", label: "Objetivo", hint: "Direto ao ponto, frases curtas." },
];

export const AGENT_LANGUAGES: { value: AgentLanguage; label: string }[] = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en", label: "Inglês" },
  { value: "es", label: "Espanhol" },
];

export const MAX_SUGGESTIONS = 6;

/** Mesmas sugestões padrão do servidor (server/src/lib/agent.ts). */
export const DEFAULT_SUGGESTIONS = [
  "Quais são as regras do condomínio?",
  "Como reservar o salão de festas?",
  "Qual é o horário permitido para obras?",
  "Posso receber visitantes?",
  "Onde encontro os comunicados?",
  "Quais são as regras para animais de estimação?",
];

/** Valores do formulário a partir da configuração (campos vazios = padrão do sistema). */
export function toInput(s: AgentSettings): AgentSettingsInput {
  return {
    name: s.custom.name ?? "",
    greeting: s.custom.greeting ?? "",
    personality: s.custom.personality ?? "",
    language: s.language,
    tone: s.tone,
    suggestions: s.custom.suggestions,
    avatar_icon: s.avatar_icon,
  };
}

export const sameInput = (a: AgentSettingsInput, b: AgentSettingsInput) => JSON.stringify(a) === JSON.stringify(b);

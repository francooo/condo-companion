import { Router, type Request } from "express";
import { query } from "../db.js";
import { requireAuth, requireRole, type AuthUser } from "../middleware/auth.js";
import {
  AGENT_ICONS,
  AGENT_LANGUAGES,
  AGENT_TONES,
  MAX_SUGGESTIONS,
  loadAgent,
  loadReadiness,
  type AgentPersona,
} from "../lib/agent.js";
import { generateAnswer } from "../lib/assistant.js";
import { logActivity } from "../lib/activity.js";

const router = Router();

const isUuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const LIMITS = { name: 60, greeting: 300, personality: 300, suggestion: 120 };
const MAX_TEST_CHARS = 2000;

/** Admin no próprio condomínio; a plataforma informa `condo_id` (query ou corpo). */
function scopeFor(user: AuthUser, req: Request): string | null {
  if (user.role === "superadmin") {
    const requested = req.query.condo_id ?? req.body?.condo_id;
    return isUuid(requested) ? String(requested) : null;
  }
  return user.condo_id;
}

const textOrNull = (v: unknown, max: number) => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};

type ParsedSettings = {
  name: string | null;
  greeting: string | null;
  personality: string | null;
  language: string;
  tone: string;
  suggestions: string[];
  avatar_icon: string;
};

/** Valida o corpo de configuração. Devolve a mensagem de erro em `error`. */
export function parseSettings(body: Record<string, unknown>): { value?: ParsedSettings; error?: string } {
  const language = String(body.language ?? "pt-BR");
  const tone = String(body.tone ?? "amigavel");
  const avatar = String(body.avatar_icon ?? "sparkles");
  if (!AGENT_LANGUAGES.includes(language as never)) return { error: "Idioma inválido." };
  if (!AGENT_TONES.includes(tone as never)) return { error: "Tom de comunicação inválido." };
  if (!AGENT_ICONS.includes(avatar as never)) return { error: "Ícone inválido." };
  if (body.suggestions !== undefined && !Array.isArray(body.suggestions)) return { error: "Sugestões devem ser uma lista." };
  const suggestions = ((body.suggestions as unknown[]) ?? [])
    .map((s) => textOrNull(s, LIMITS.suggestion))
    .filter((s): s is string => Boolean(s));
  if (suggestions.length > MAX_SUGGESTIONS) return { error: `Use no máximo ${MAX_SUGGESTIONS} sugestões.` };
  if (new Set(suggestions.map((s) => s.toLowerCase())).size !== suggestions.length) return { error: "Há sugestões repetidas." };
  return {
    value: {
      name: textOrNull(body.name, LIMITS.name),
      greeting: textOrNull(body.greeting, LIMITS.greeting),
      personality: textOrNull(body.personality, LIMITS.personality),
      language,
      tone,
      suggestions,
      avatar_icon: avatar,
    },
  };
}

/** O que o morador precisa para o chat: identidade e se está liberado. */
router.get("/", requireAuth, async (req, res) => {
  try {
    const condoId = scopeFor(req.user!, req);
    if (!condoId) return res.status(400).json({ error: "Informe o condomínio (condo_id)." });
    const agent = await loadAgent(condoId);
    if (!agent) return res.status(404).json({ error: "Condomínio não encontrado." });
    res.json({
      agent: {
        name: agent.name,
        greeting: agent.greeting,
        suggestions: agent.suggestions,
        avatar_icon: agent.avatar_icon,
        enabled: agent.enabled,
      },
    });
  } catch (e) {
    console.error("get agent error:", e);
    res.status(500).json({ error: "Não foi possível carregar o assistente." });
  }
});

router.get("/settings", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const condoId = scopeFor(req.user!, req);
    if (!condoId) return res.status(400).json({ error: "Informe o condomínio (condo_id)." });
    const agent = await loadAgent(condoId);
    if (!agent) return res.status(404).json({ error: "Condomínio não encontrado." });
    res.json({ settings: agent, readiness: await loadReadiness(condoId, agent.enabled) });
  } catch (e) {
    console.error("get agent settings error:", e);
    res.status(500).json({ error: "Não foi possível carregar a configuração." });
  }
});

router.put("/settings", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const condoId = scopeFor(req.user!, req);
    if (!condoId) return res.status(400).json({ error: "Informe o condomínio (condo_id)." });
    const { value, error } = parseSettings(req.body ?? {});
    if (!value) return res.status(400).json({ error });
    if (!(await loadAgent(condoId))) return res.status(404).json({ error: "Condomínio não encontrado." });

    await query(
      `INSERT INTO agent_settings (condo_id, name, greeting, personality, language, tone, suggestions, avatar_icon, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       ON CONFLICT (condo_id) DO UPDATE SET
         name = EXCLUDED.name, greeting = EXCLUDED.greeting, personality = EXCLUDED.personality,
         language = EXCLUDED.language, tone = EXCLUDED.tone, suggestions = EXCLUDED.suggestions,
         avatar_icon = EXCLUDED.avatar_icon, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [condoId, value.name, value.greeting, value.personality, value.language, value.tone, value.suggestions, value.avatar_icon, req.user!.id]
    );
    await logActivity({ condoId, actorId: req.user!.id, type: "agent.updated" });
    const agent = (await loadAgent(condoId))!;
    res.json({ settings: agent, readiness: await loadReadiness(condoId, agent.enabled) });
  } catch (e) {
    console.error("update agent settings error:", e);
    res.status(500).json({ error: "Não foi possível salvar a configuração." });
  }
});

/** Libera ou retira o assistente dos moradores. Só libera com ao menos um documento processado e ativo. */
router.put("/availability", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const condoId = scopeFor(req.user!, req);
    if (!condoId) return res.status(400).json({ error: "Informe o condomínio (condo_id)." });
    if (typeof req.body?.enabled !== "boolean") return res.status(400).json({ error: "enabled deve ser booleano." });
    const enabled: boolean = req.body.enabled;
    const current = await loadAgent(condoId);
    if (!current) return res.status(404).json({ error: "Condomínio não encontrado." });
    if (enabled) {
      const readiness = await loadReadiness(condoId, current.enabled);
      if (readiness.counts.available === 0) {
        return res.status(409).json({
          error: "Processe ao menos um documento antes de liberar o assistente aos moradores.",
          code: "agent_incomplete",
        });
      }
    }
    await query(
      `INSERT INTO agent_settings (condo_id, enabled, updated_by, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (condo_id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [condoId, enabled, req.user!.id]
    );
    if (enabled !== current.enabled) {
      await logActivity({ condoId, actorId: req.user!.id, type: enabled ? "agent.enabled" : "agent.disabled" });
    }
    const agent = (await loadAgent(condoId))!;
    res.json({ settings: agent, readiness: await loadReadiness(condoId, agent.enabled) });
  } catch (e) {
    console.error("agent availability error:", e);
    res.status(500).json({ error: "Não foi possível alterar a disponibilidade." });
  }
});

/**
 * Teste do agente pela administração: mesma lógica do chat, sem gravar conversa e mesmo que o
 * assistente ainda não esteja liberado. Aceita uma configuração em edição (`draft`) para testar
 * antes de salvar.
 */
router.post("/test", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const condoId = scopeFor(req.user!, req);
    if (!condoId) return res.status(400).json({ error: "Informe o condomínio (condo_id)." });
    const question = String(req.body?.question ?? "").trim();
    if (!question) return res.status(400).json({ error: "Escreva uma pergunta." });
    if (question.length > MAX_TEST_CHARS) return res.status(400).json({ error: `A pergunta pode ter até ${MAX_TEST_CHARS} caracteres.` });

    const agent = await loadAgent(condoId);
    if (!agent) return res.status(404).json({ error: "Condomínio não encontrado." });
    let persona: AgentPersona = agent;
    if (req.body?.draft) {
      const { value, error } = parseSettings(req.body.draft);
      if (!value) return res.status(400).json({ error });
      persona = {
        name: value.name ?? agent.name,
        personality: value.personality,
        tone: value.tone as AgentPersona["tone"],
        language: value.language as AgentPersona["language"],
      };
    }
    const answer = await generateAnswer(condoId, question, [], persona);
    res.json({ answer });
  } catch (e) {
    console.error("agent test error:", e);
    res.status(500).json({ error: "Não foi possível testar o assistente." });
  }
});

export default router;

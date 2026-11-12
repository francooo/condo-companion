import { describe, expect, it } from "vitest";
import { conversationTitle, sanitizePreferences } from "../../server/src/lib/chat-utils";
import { chatTime, conversationWhen } from "@/lib/format";

describe("conversationTitle", () => {
  it("mantém perguntas curtas e normaliza espaços", () => {
    expect(conversationTitle("  Qual o horário   da piscina? ")).toBe("Qual o horário da piscina?");
  });

  it("encurta perguntas longas numa fronteira de palavra", () => {
    const q = "Gostaria de saber quais são as regras para reforma do apartamento, incluindo horários, ruídos e descarte de entulho";
    const t = conversationTitle(q);
    expect(t.endsWith("…")).toBe(true);
    expect(t.length).toBeLessThanOrEqual(81);
    expect(q.startsWith(t.slice(0, -1))).toBe(true);
    expect(t).not.toMatch(/[ ,]…$/);
  });
});

describe("sanitizePreferences", () => {
  it("aceita só chaves e valores conhecidos", () => {
    expect(sanitizePreferences({ text_size: "large" })).toEqual({ text_size: "large" });
    expect(sanitizePreferences({ reduced_motion: true, text_size: "normal" })).toEqual({ reduced_motion: true, text_size: "normal" });
    expect(sanitizePreferences({ text_size: "huge" })).toBeNull();
    expect(sanitizePreferences({ reduced_motion: "sim" })).toBeNull();
    expect(sanitizePreferences({ other: 1 })).toBeNull();
    expect(sanitizePreferences([])).toBeNull();
    expect(sanitizePreferences(null)).toBeNull();
  });
});

describe("datas do chat", () => {
  const now = new Date(2026, 10, 12, 15, 0);
  it("chatTime: agora, hoje e outros dias", () => {
    expect(chatTime(new Date(2026, 10, 12, 14, 59, 30).toISOString(), now)).toBe("Agora");
    expect(chatTime(new Date(2026, 10, 12, 10, 42).toISOString(), now)).toBe("10:42");
    expect(chatTime(new Date(2026, 10, 10, 9, 5).toISOString(), now)).toMatch(/10 de nov.*09:05/);
  });
  it("conversationWhen: hoje, ontem e data completa", () => {
    expect(conversationWhen(new Date(2026, 10, 12, 10, 42).toISOString(), now)).toBe("Hoje, 10:42");
    expect(conversationWhen(new Date(2026, 10, 11, 18, 3).toISOString(), now)).toBe("Ontem, 18:03");
    expect(conversationWhen(new Date(2026, 9, 18, 8, 0).toISOString(), now)).toMatch(/18 de out.* 2026/);
  });
});

import { describe, expect, it } from "vitest";
import { hasApprovedAccess, homePathFor } from "@/components/layout/nav";
import { formatPhone, relativeTime } from "@/lib/format";

const CONDO = "11111111-1111-1111-1111-111111111111";

describe("homePathFor", () => {
  it("leva visitantes para as boas-vindas", () => {
    expect(homePathFor(null)).toBe("/boas-vindas");
  });

  it("leva o administrador da plataforma para o painel da plataforma", () => {
    expect(homePathFor({ role: "superadmin", condo_id: null, membership_status: "approved" })).toBe("/plataforma");
  });

  it("leva morador sem condomínio para a busca", () => {
    expect(homePathFor({ role: "resident", condo_id: null, membership_status: null })).toBe("/vinculo");
  });

  it.each(["pending", "rejected", "suspended"])("leva morador com vínculo %s para a situação da solicitação", (status) => {
    expect(homePathFor({ role: "resident", condo_id: CONDO, membership_status: status })).toBe("/vinculo/status");
  });

  it("leva morador aprovado para o chat e síndico para o painel", () => {
    expect(homePathFor({ role: "resident", condo_id: CONDO, membership_status: "approved" })).toBe("/chat");
    expect(homePathFor({ role: "admin", condo_id: CONDO, membership_status: "approved" })).toBe("/admin");
  });
});

describe("hasApprovedAccess", () => {
  it("só libera vínculo aprovado com condomínio", () => {
    expect(hasApprovedAccess({ role: "resident", condo_id: CONDO, membership_status: "approved" })).toBe(true);
    expect(hasApprovedAccess({ role: "resident", condo_id: CONDO, membership_status: "pending" })).toBe(false);
    expect(hasApprovedAccess({ role: "resident", condo_id: null, membership_status: "approved" })).toBe(false);
    expect(hasApprovedAccess({ role: "superadmin", condo_id: null, membership_status: null })).toBe(true);
  });
});

describe("formatPhone", () => {
  it("aplica a máscara de celular progressivamente", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone("11")).toBe("(11");
    expect(formatPhone("119")).toBe("(11) 9");
    expect(formatPhone("11999991234")).toBe("(11) 99999-1234");
    expect(formatPhone("1133334444")).toBe("(11) 3333-4444");
  });

  it("ignora caracteres extras e limita a 11 dígitos", () => {
    expect(formatPhone("(11) 99999-12345678")).toBe("(11) 99999-1234");
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-11-12T12:00:00Z").getTime();
  it("usa minutos, horas e dias", () => {
    expect(relativeTime("2026-11-12T11:55:00Z", now)).toBe("há 5 minutos");
    expect(relativeTime("2026-11-12T10:00:00Z", now)).toBe("há 2 horas");
    expect(relativeTime("2026-11-11T12:00:00Z", now)).toBe("ontem");
  });
});

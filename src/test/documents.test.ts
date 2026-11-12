import { describe, expect, it, vi } from "vitest";
import { chunkPages, chunkText, cleanText } from "../../server/src/lib/chunking";

vi.mock("@/lib/pdf-utils", async () => {
  // pdfjs não roda no jsdom; os testes só usam a detecção de formato.
  const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const documentKind = (f: { name: string; type: string }) => {
    const n = f.name.toLowerCase();
    if (n.endsWith(".pdf") || f.type === "application/pdf") return "pdf";
    if (n.endsWith(".docx") || f.type === DOCX_MIME) return "docx";
    if (n.endsWith(".txt") || f.type === "text/plain") return "txt";
    return null;
  };
  return { documentKind, extractPages: vi.fn(), MIME_BY_KIND: {}, DOCX_MIME };
});

const { categoryLabel, formatBytes, kindLabel, validateFile } = await import("@/lib/documents");

const words = (n: number, prefix = "w") => Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(" ");

describe("chunkText", () => {
  it("devolve um trecho para textos curtos", () => {
    expect(chunkText("um dois três")).toEqual(["um dois três"]);
    expect(chunkText("   ")).toEqual([]);
  });

  it("usa janelas com sobreposição e não repete o final", () => {
    const chunks = chunkText(words(25), 10, 2);
    expect(chunks).toHaveLength(3);
    expect(chunks[0].split(" ")).toHaveLength(10);
    expect(chunks[1].startsWith("w8 w9")).toBe(true);
    expect(chunks.at(-1)!.endsWith("w24")).toBe(true);
  });
});

describe("chunkPages", () => {
  it("mantém cada trecho dentro de uma única página e numera em sequência", () => {
    const chunks = chunkPages(
      [
        { page: 1, text: words(15, "a") },
        { page: 2, text: "" },
        { page: 3, text: words(4, "c") },
      ],
      10,
      2,
    );
    expect(chunks.map((c) => c.page)).toEqual([1, 1, 3]);
    expect(chunks.map((c) => c.index)).toEqual([0, 1, 2]);
    expect(chunks.every((c) => !c.content.includes("c0") || c.page === 3)).toBe(true);
  });

  it("aceita formatos sem paginação", () => {
    expect(chunkPages([{ page: null, text: "texto simples" }])).toEqual([{ page: null, index: 0, content: "texto simples" }]);
  });
});

describe("cleanText", () => {
  it("remove NUL e normaliza espaços sem perder quebras de parágrafo", () => {
    expect(cleanText("  a\u0000b\t\tc \n\n\n\nd  ")).toBe("ab c \n\nd");
  });
});

describe("helpers de documentos", () => {
  it("formata tamanhos", () => {
    expect(formatBytes(null)).toBe("Tamanho desconhecido");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(840 * 1024)).toBe("840 KB");
    expect(formatBytes(1.8 * 1024 * 1024)).toBe("1,8 MB");
  });

  it("identifica tipo e categoria", () => {
    expect(kindLabel({ filename: "Regimento.PDF" })).toBe("PDF");
    expect(kindLabel({ filename: "ata.docx" })).toBe("DOCX");
    expect(categoryLabel("atas")).toBe("Atas de assembleia");
    expect(categoryLabel("desconhecida")).toBe("Outros");
  });

  it("valida formato, vazio e tamanho máximo", () => {
    const file = (name: string, size: number, type = "") => {
      const f = new File(["x"], name, { type });
      Object.defineProperty(f, "size", { value: size });
      return f;
    };
    expect(validateFile(file("foto.png", 10))).toMatch(/Formato/);
    expect(validateFile(file("vazio.pdf", 0))).toMatch(/vazio/);
    expect(validateFile(file("grande.pdf", 26 * 1024 * 1024))).toMatch(/25 MB/);
    expect(validateFile(file("ok.txt", 100))).toBeNull();
  });
});

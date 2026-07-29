import { Router } from "express";
import { query } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { groqChat, MODEL_DOCS } from "../lib/groq";

const router = Router();

function chunkText(text: string, chunkSize = 900, overlap = 100): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim()) chunks.push(chunk.trim());
    i += chunkSize - overlap;
  }
  return chunks;
}

async function processChunk(chunk: string): Promise<{ summary: string; topics: string[] }> {
  const prompt = `A partir do texto de um documento de condomínio abaixo, produza um resumo conciso (2-4 frases) e de 3 a 8 tópicos/palavras-chave. Responda APENAS em JSON no formato {"summary": string, "topics": string[]}.

Texto:
"""
${chunk.slice(0, 6000)}
"""`;

  try {
    const raw = await groqChat(prompt, undefined, { model: MODEL_DOCS, maxTokens: 500 });
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return { summary: parsed.summary || "", topics: Array.isArray(parsed.topics) ? parsed.topics : [] };
    }
  } catch (e) {
    console.error("document chunk processing error:", e);
  }
  return { summary: "", topics: [] };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, i: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

router.post("/", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const { text, filename, condo_id } = req.body;
    if (!text || typeof text !== "string") return res.status(400).json({ error: "text é obrigatório" });

    const targetCondoId = req.user!.role === "superadmin" ? condo_id : req.user!.condo_id;
    if (!targetCondoId) return res.status(400).json({ error: "condo_id é obrigatório" });

    const chunks = chunkText(text);
    const processed = await mapWithConcurrency(chunks, 3, (chunk) => processChunk(chunk));

    for (let i = 0; i < chunks.length; i++) {
      await query(`INSERT INTO knowledge_base (condo_id, content, metadata) VALUES ($1, $2, $3)`, [
        targetCondoId,
        chunks[i],
        JSON.stringify({ filename, chunk_index: i, ...processed[i] }),
      ]);
    }

    res.json({ success: true, count: chunks.length });
  } catch (e: any) {
    console.error("document processing error:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;

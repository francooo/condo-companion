import express, { Router, type Request, type Response } from "express";
import type { PoolClient } from "pg";
import { pool, query } from "../db.js";
import { requireAuth, requireRole, type AuthUser } from "../middleware/auth.js";
import { groqChat, MODEL_DOCS } from "../lib/groq.js";
import { chunkPages, cleanText, type PageText } from "../lib/chunking.js";

const router = Router();

export const DOCUMENT_CATEGORIES = ["convencao", "regimento", "atas", "comunicados", "regulamentos", "manuais", "outros"] as const;
const ACCEPTED_MIME = new Set([
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
/** O corpo de uma Serverless Function do Vercel é limitado a 4,5 MB; o original acima disso não é guardado. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_PAGES = 3000;
const MAX_TEXT_CHARS = 3_000_000;
/** Abaixo disso o arquivo provavelmente é digitalizado (imagem) e não há o que indexar. */
const MIN_TEXT_CHARS = 200;
/** Trechos resumidos por chamada de processamento: cabe com folga no tempo de uma função serverless. */
const PROCESS_BATCH = 6;

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const clean = (v: unknown, max: number) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};

const DOC_FIELDS = `d.id, d.condo_id, d.filename, d.mime, d.size, d.category, d.description, d.status, d.active,
  d.page_count, d.chunk_count, d.error, (d.file_id IS NOT NULL) AS has_file, d.created_at, d.updated_at,
  d.processed_at, u.full_name AS uploaded_by_name`;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function send(res: Response, e: unknown, label: string) {
  if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
  console.error(`${label}:`, e);
  res.status(500).json({ error: "Erro interno ao tratar o documento." });
}

/** Admin fica preso ao próprio condomínio; o administrador da plataforma informa o condomínio. */
function resolveCondoScope(user: AuthUser, requested: unknown): string {
  if (user.role === "superadmin") {
    const id = String(requested ?? "");
    if (!isUuid(id)) throw new HttpError(400, "Informe o condomínio (condo_id).");
    return id;
  }
  if (!user.condo_id) throw new HttpError(403, "Acesso negado");
  return user.condo_id;
}

/** Carrega o documento respeitando o escopo do usuário. Fora do escopo responde como inexistente. */
async function loadDocument(user: AuthUser, id: string) {
  if (!isUuid(id)) throw new HttpError(404, "Documento não encontrado.");
  const { rows } = await query(
    `SELECT ${DOC_FIELDS}, d.file_id, c.name AS condo_name,
            (SELECT COUNT(*)::int FROM knowledge_base kb WHERE kb.document_id = d.id AND kb.summarized) AS summarized_count,
            (SELECT f.size FROM files f WHERE f.id = d.file_id) AS file_size
       FROM documents d
       JOIN condos c ON c.id = d.condo_id
       LEFT JOIN users u ON u.id = d.uploaded_by
      WHERE d.id = $1`,
    [id]
  );
  const doc = rows[0];
  if (!doc || (user.role !== "superadmin" && doc.condo_id !== user.condo_id)) {
    throw new HttpError(404, "Documento não encontrado.");
  }
  return doc;
}

function publicDoc(doc: Record<string, unknown>) {
  const { file_id: _fileId, ...rest } = doc;
  return rest;
}

/** Valida o corpo de criação/substituição e devolve páginas limpas. */
/* eslint-disable @typescript-eslint/no-explicit-any -- corpo JSON livre, validado campo a campo */
function parseUpload(body: any) {
  const filename = clean(body.filename, 200);
  if (!filename) throw new HttpError(400, "Nome do arquivo é obrigatório.");
  const mime = clean(body.mime, 120);
  if (mime && !ACCEPTED_MIME.has(mime)) throw new HttpError(400, "Formato não suportado. Use PDF, DOCX ou TXT.");
  const size = Number.isFinite(Number(body.size)) && Number(body.size) > 0 ? Math.round(Number(body.size)) : null;

  if (!Array.isArray(body.pages)) throw new HttpError(400, "O texto extraído (pages) é obrigatório.");
  if (body.pages.length > MAX_PAGES) throw new HttpError(400, `O documento passa de ${MAX_PAGES} páginas.`);

  let total = 0;
  const pages: PageText[] = [];
  for (const raw of body.pages) {
    const page = raw?.page == null ? null : Number(raw.page);
    if (page !== null && (!Number.isInteger(page) || page < 1)) throw new HttpError(400, "Número de página inválido.");
    const text = cleanText(String(raw?.text ?? ""));
    total += text.length;
    if (total > MAX_TEXT_CHARS) throw new HttpError(413, "O texto do documento é grande demais para indexar.");
    pages.push({ page, text });
  }
  const pageCount = pages.some((p) => p.page !== null) ? Math.max(...pages.map((p) => p.page ?? 0)) : null;
  return { filename, mime, size, pages, pageCount, totalChars: total };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Grava páginas e trechos (ainda sem resumo) dentro de uma transação já aberta. */
async function writeContent(client: PoolClient, doc: { id: string; condo_id: string; filename: string }, pages: PageText[]) {
  const paged = pages.filter((p) => p.page !== null && p.text);
  if (paged.length) {
    await client.query(
      `INSERT INTO document_pages (document_id, page, content)
       SELECT $1, p, c FROM unnest($2::int[], $3::text[]) AS t(p, c)
       ON CONFLICT (document_id, page) DO UPDATE SET content = EXCLUDED.content`,
      [doc.id, paged.map((p) => p.page), paged.map((p) => p.text)]
    );
  }
  const chunks = chunkPages(pages.filter((p) => p.text));
  if (chunks.length) {
    await client.query(
      `INSERT INTO knowledge_base (condo_id, document_id, page, content, metadata)
       SELECT $1, $2, p, c, jsonb_build_object('filename', $3::text, 'chunk_index', i, 'page', p)
         FROM unnest($4::int[], $5::text[], $6::int[]) AS t(p, c, i)`,
      [doc.condo_id, doc.id, doc.filename, chunks.map((c) => c.page), chunks.map((c) => c.content), chunks.map((c) => c.index)]
    );
  }
  return chunks.length;
}

function initialStatus(chunks: number, totalChars: number) {
  if (chunks === 0 || totalChars < MIN_TEXT_CHARS) {
    return {
      status: "needs_review",
      error:
        "Encontramos pouco ou nenhum texto no arquivo. Ele pode ser uma imagem digitalizada; envie uma versão com texto selecionável.",
    };
  }
  return { status: "uploaded", error: null };
}

async function summarizeChunk(chunk: string): Promise<{ summary: string; topics: string[] }> {
  const prompt = `A partir do texto de um documento de condomínio abaixo, produza um resumo conciso (2-4 frases) e de 3 a 8 tópicos/palavras-chave. Responda APENAS em JSON no formato {"summary": string, "topics": string[]}.

Texto:
"""
${chunk.slice(0, 6000)}
"""`;
  // Falha de rede/API propaga (o lote não avança); resposta fora do formato apenas fica sem resumo.
  const raw = await groqChat(prompt, undefined, { model: MODEL_DOCS, maxTokens: 500 });
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        summary: typeof parsed.summary === "string" ? parsed.summary : "",
        topics: Array.isArray(parsed.topics) ? parsed.topics.filter((t: unknown) => typeof t === "string").slice(0, 8) : [],
      };
    }
  } catch {
    // segue sem resumo
  }
  return { summary: "", topics: [] };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      try {
        results[current] = { status: "fulfilled", value: await fn(items[current]) };
      } catch (reason) {
        results[current] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

// ---------------------------------------------------------------------------
// Biblioteca (administração do condomínio ou da plataforma)
// ---------------------------------------------------------------------------

router.get("/", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const condoId = resolveCondoScope(req.user!, req.query.condo_id);
    const { rows } = await query(
      `SELECT ${DOC_FIELDS}
         FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by
        WHERE d.condo_id = $1
        ORDER BY d.created_at DESC
        LIMIT 500`,
      [condoId]
    );
    res.json({ documents: rows });
  } catch (e) {
    send(res, e, "list documents error");
  }
});

/** Cria o documento com o texto já extraído no navegador (por página). O processamento vem depois, em lotes. */
router.post("/", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  const client = await pool.connect();
  try {
    const condoId = resolveCondoScope(req.user!, req.body.condo_id);
    const category = DOCUMENT_CATEGORIES.includes(req.body.category) ? req.body.category : "outros";
    const description = clean(req.body.description, 500);
    const upload = parseUpload(req.body);

    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO documents (condo_id, filename, mime, size, category, description, page_count, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, condo_id, filename`,
      [condoId, upload.filename, upload.mime, upload.size, category, description, upload.pageCount, req.user!.id]
    );
    const doc = rows[0];
    const chunks = await writeContent(client, doc, upload.pages);
    const { status, error } = initialStatus(chunks, upload.totalChars);
    await client.query(`UPDATE documents SET chunk_count = $2, status = $3, error = $4 WHERE id = $1`, [doc.id, chunks, status, error]);
    await client.query("COMMIT");

    res.status(201).json({ document: publicDoc(await loadDocument(req.user!, doc.id)) });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    if ((e as { code?: string }).code === "23503") return send(res, new HttpError(404, "Condomínio não encontrado."), "");
    send(res, e, "create document error");
  } finally {
    client.release();
  }
});

router.get("/:id", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    res.json({ document: publicDoc(await loadDocument(req.user!, req.params.id)) });
  } catch (e) {
    send(res, e, "get document error");
  }
});

router.patch("/:id", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const doc = await loadDocument(req.user!, req.params.id);
    const sets: string[] = [];
    const params: unknown[] = [doc.id];
    if (req.body.category !== undefined) {
      if (!DOCUMENT_CATEGORIES.includes(req.body.category)) return res.status(400).json({ error: "Categoria inválida." });
      params.push(req.body.category);
      sets.push(`category = $${params.length}`);
    }
    if (req.body.description !== undefined) {
      params.push(clean(req.body.description, 500));
      sets.push(`description = $${params.length}`);
    }
    if (req.body.active !== undefined) {
      if (typeof req.body.active !== "boolean") return res.status(400).json({ error: "active deve ser booleano." });
      params.push(req.body.active);
      sets.push(`active = $${params.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: "Nada para atualizar." });
    await query(`UPDATE documents SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`, params);
    res.json({ document: publicDoc(await loadDocument(req.user!, doc.id)) });
  } catch (e) {
    send(res, e, "update document error");
  }
});

router.delete("/:id", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const doc = await loadDocument(req.user!, req.params.id);
    await query(`DELETE FROM documents WHERE id = $1`, [doc.id]);
    if (doc.file_id) await query(`DELETE FROM files WHERE id = $1`, [doc.file_id]);
    res.status(204).end();
  } catch (e) {
    send(res, e, "delete document error");
  }
});

/** Substitui o conteúdo (nova versão do arquivo): mantém id, categoria e histórico; reinicia o processamento. */
router.post("/:id/replace", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  const client = await pool.connect();
  try {
    const doc = await loadDocument(req.user!, req.params.id);
    const upload = parseUpload(req.body);

    await client.query("BEGIN");
    await client.query(`DELETE FROM knowledge_base WHERE document_id = $1`, [doc.id]);
    await client.query(`DELETE FROM document_pages WHERE document_id = $1`, [doc.id]);
    await client.query(
      `UPDATE documents SET filename = $2, mime = $3, size = $4, page_count = $5, file_id = NULL,
              uploaded_by = $6, processed_at = NULL, updated_at = now()
        WHERE id = $1`,
      [doc.id, upload.filename, upload.mime, upload.size, upload.pageCount, req.user!.id]
    );
    if (doc.file_id) await client.query(`DELETE FROM files WHERE id = $1`, [doc.file_id]);
    const chunks = await writeContent(client, { id: doc.id, condo_id: doc.condo_id, filename: upload.filename }, upload.pages);
    const { status, error } = initialStatus(chunks, upload.totalChars);
    await client.query(`UPDATE documents SET chunk_count = $2, status = $3, error = $4 WHERE id = $1`, [doc.id, chunks, status, error]);
    await client.query("COMMIT");

    res.json({ document: publicDoc(await loadDocument(req.user!, doc.id)) });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    send(res, e, "replace document error");
  } finally {
    client.release();
  }
});

/**
 * Processa o próximo lote de trechos (resumo + tópicos). O cliente repete a chamada até `processed`,
 * o que mantém cada requisição curta mesmo em documentos longos.
 * `force: true` libera um documento marcado "precisa de revisão".
 */
router.post("/:id/process", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  const user = req.user!;
  let docId: string | null = null;
  try {
    const doc = await loadDocument(user, req.params.id);
    docId = doc.id;
    const total = Number(doc.chunk_count);
    if (doc.status === "processed") return res.json({ document: publicDoc(doc), processed: total, total });
    if (doc.status === "needs_review" && !(req.body?.force === true && total > 0)) {
      return res.status(409).json({ error: doc.error || "O documento precisa de revisão antes de ser processado." });
    }

    await query(`UPDATE documents SET status = 'processing', error = NULL, updated_at = now() WHERE id = $1`, [doc.id]);

    const { rows: batch } = await query(
      `SELECT id, content FROM knowledge_base WHERE document_id = $1 AND NOT summarized
        ORDER BY page NULLS FIRST, (metadata->>'chunk_index')::int LIMIT $2`,
      [doc.id, PROCESS_BATCH]
    );
    const results = await mapWithConcurrency(batch, 3, (c: { content: string }) => summarizeChunk(c.content));
    let progressed = 0;
    for (let i = 0; i < batch.length; i++) {
      const r = results[i];
      if (r.status !== "fulfilled") continue;
      progressed++;
      await query(
        `UPDATE knowledge_base SET metadata = metadata || $2::jsonb, summarized = true WHERE id = $1`,
        [batch[i].id, JSON.stringify(r.value)]
      );
    }
    if (batch.length > 0 && progressed === 0) {
      const reason = results.find((r): r is PromiseRejectedResult => r.status === "rejected")?.reason;
      console.error("document processing batch failed:", reason);
      throw new HttpError(502, "O serviço de IA não respondeu. Tente processar novamente em instantes.");
    }

    const { rows: count } = await query(
      `SELECT COUNT(*) FILTER (WHERE summarized)::int AS done, COUNT(*)::int AS total FROM knowledge_base WHERE document_id = $1`,
      [doc.id]
    );
    const { done, total: all } = count[0];
    if (done >= all) {
      await query(
        `UPDATE documents SET status = 'processed', chunk_count = $2, processed_at = now(), updated_at = now() WHERE id = $1`,
        [doc.id, all]
      );
    }
    res.json({ document: publicDoc(await loadDocument(user, doc.id)), processed: done, total: all });
  } catch (e) {
    if (docId && !(e instanceof HttpError && e.status < 500)) {
      const message = e instanceof HttpError ? e.message : "Falha inesperada ao processar o documento.";
      await query(`UPDATE documents SET status = 'failed', error = $2, updated_at = now() WHERE id = $1`, [docId, message]).catch(
        () => {}
      );
    }
    send(res, e, "process document error");
  }
});

// ---------------------------------------------------------------------------
// Arquivo original
// ---------------------------------------------------------------------------

router.put(
  "/:id/file",
  requireAuth,
  requireRole("admin", "superadmin"),
  express.raw({ type: () => true, limit: MAX_FILE_BYTES }),
  async (req: Request, res: Response) => {
    try {
      const doc = await loadDocument(req.user!, req.params.id);
      const data = req.body;
      if (!Buffer.isBuffer(data) || data.length === 0) return res.status(400).json({ error: "Arquivo vazio." });
      const mime = String(req.headers["content-type"] ?? "").split(";")[0].trim();
      if (!ACCEPTED_MIME.has(mime)) return res.status(400).json({ error: "Formato não suportado. Use PDF, DOCX ou TXT." });

      const { rows } = await query(
        `INSERT INTO files (condo_id, kind, mime, size, data) VALUES ($1, 'document', $2, $3, $4) RETURNING id`,
        [doc.condo_id, mime, data.length, data]
      );
      await query(`UPDATE documents SET file_id = $2, updated_at = now() WHERE id = $1`, [doc.id, rows[0].id]);
      if (doc.file_id) await query(`DELETE FROM files WHERE id = $1`, [doc.file_id]);
      res.json({ document: publicDoc(await loadDocument(req.user!, doc.id)) });
    } catch (e) {
      send(res, e, "upload document file error");
    }
  }
);

router.get("/:id/file", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const doc = await loadDocument(req.user!, req.params.id);
    if (!doc.file_id) return res.status(404).json({ error: "O arquivo original não está disponível." });
    const { rows } = await query(`SELECT mime, data FROM files WHERE id = $1`, [doc.file_id]);
    if (!rows[0]) return res.status(404).json({ error: "O arquivo original não está disponível." });
    res.setHeader("Content-Type", rows[0].mime);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(doc.filename)}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(rows[0].data);
  } catch (e) {
    send(res, e, "download document file error");
  }
});

// ---------------------------------------------------------------------------
// Texto por página: prévia (administração) e fonte citada (morador do condomínio)
// ---------------------------------------------------------------------------

/** Identificação de um documento citado como fonte. Morador só vê documento processado e ativo do próprio condomínio. */
async function loadCitable(user: AuthUser, id: string) {
  if (!isUuid(id)) return null;
  const { rows } = await query(
    `SELECT d.id, d.condo_id, d.filename, d.category, d.status, d.active, d.page_count, c.name AS condo_name
       FROM documents d JOIN condos c ON c.id = d.condo_id WHERE d.id = $1`,
    [id]
  );
  const doc = rows[0];
  if (!doc) return null;
  const isAdmin = user.role === "superadmin" || (user.role === "admin" && doc.condo_id === user.condo_id);
  const canRead = isAdmin || (doc.condo_id === user.condo_id && doc.status === "processed" && doc.active);
  return canRead ? doc : null;
}

router.get("/:id/source", requireAuth, async (req, res) => {
  try {
    const doc = await loadCitable(req.user!, req.params.id);
    if (!doc) return res.status(404).json({ error: "Documento não encontrado." });
    res.json({
      document: { id: doc.id, filename: doc.filename, category: doc.category, page_count: doc.page_count, condo_name: doc.condo_name },
    });
  } catch (e) {
    send(res, e, "document source error");
  }
});

router.get("/:id/pages/:page", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const page = Number(req.params.page);
    if (!isUuid(req.params.id) || !Number.isInteger(page) || page < 1) return res.status(404).json({ error: "Página não encontrada." });

    const { rows } = await query(
      `SELECT d.id, d.condo_id, d.filename, d.status, d.active, d.page_count, p.content
         FROM documents d
         LEFT JOIN document_pages p ON p.document_id = d.id AND p.page = $2
        WHERE d.id = $1`,
      [req.params.id, page]
    );
    const doc = rows[0];
    const isAdmin = user.role === "superadmin" || (user.role === "admin" && doc?.condo_id === user.condo_id);
    const canRead = isAdmin || (doc?.condo_id === user.condo_id && doc?.status === "processed" && doc?.active);
    if (!doc || !canRead) return res.status(404).json({ error: "Documento não encontrado." });
    if (!doc.page_count || page > doc.page_count) return res.status(404).json({ error: "Página não encontrada." });

    res.json({
      document: { id: doc.id, filename: doc.filename, page_count: doc.page_count },
      page,
      content: doc.content ?? "",
    });
  } catch (e) {
    send(res, e, "document page error");
  }
});

export default router;

import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { groqChat, MODEL_FAST, MODEL_CHAT } from "../lib/groq.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "question é obrigatório" });

    const user = req.user!;
    if (!user.condo_id) return res.status(400).json({ error: "Usuário não vinculado a um condomínio" });

    const classificationPrompt = `Classifique a seguinte pergunta de um morador de condomínio em uma das duas categorias:
- "regras" — se a pergunta é sobre regras, regulamentos, convivência, normas do condomínio
- "financeiro" — se a pergunta é sobre finanças, gastos, receitas, prestação de contas, valores, despesas

Responda APENAS com a palavra "regras" ou "financeiro", sem explicação adicional.

Pergunta: "${question}"`;

    const intent = (
      await groqChat(classificationPrompt, undefined, { model: MODEL_FAST, maxTokens: 10 })
    ).trim().toLowerCase();

    let answer: string;

    if (intent.includes("financeiro")) {
      const extractPrompt = `Analise a seguinte pergunta sobre finanças de um condomínio e extraia os filtros em JSON:
{
  "category": "string ou null",
  "type": "income ou expense ou null",
  "months": "número de meses para olhar para trás ou null",
  "year": "ano específico ou null"
}

Responda APENAS com o JSON, sem explicação.

Pergunta: "${question}"`;

      const filtersRaw = await groqChat(extractPrompt, undefined, { model: MODEL_FAST, maxTokens: 200 });
      let filters: any = {};
      try {
        const match = filtersRaw.match(/\{[\s\S]*\}/);
        if (match) filters = JSON.parse(match[0]);
      } catch {
        // segue sem filtros
      }

      const params: unknown[] = [user.condo_id];
      let where = "WHERE condo_id = $1";
      if (filters.category) {
        params.push(`%${filters.category}%`);
        where += ` AND category ILIKE $${params.length}`;
      }
      if (filters.type === "income" || filters.type === "expense") {
        params.push(filters.type);
        where += ` AND type = $${params.length}`;
      }
      const monthsNum = parseInt(filters.months, 10);
      if (filters.months && !isNaN(monthsNum)) {
        const d = new Date();
        d.setMonth(d.getMonth() - monthsNum);
        params.push(d.toISOString().split("T")[0]);
        where += ` AND date >= $${params.length}`;
      }
      if (filters.year && /^\d{4}$/.test(String(filters.year))) {
        params.push(`${filters.year}-01-01`, `${filters.year}-12-31`);
        where += ` AND date >= $${params.length - 1} AND date <= $${params.length}`;
      }

      const { rows: records } = await query(
        `SELECT * FROM financial_records ${where} ORDER BY date DESC LIMIT 50`,
        params
      );

      const totalIncome = records
        .filter((r: any) => r.type === "income")
        .reduce((s: number, r: any) => s + Number(r.amount), 0);
      const totalExpense = records
        .filter((r: any) => r.type === "expense")
        .reduce((s: number, r: any) => s + Number(r.amount), 0);

      const financialContext = `Dados financeiros encontrados (${records.length} registros):
Total receitas: R$ ${totalIncome.toFixed(2)}
Total despesas: R$ ${totalExpense.toFixed(2)}
Saldo: R$ ${(totalIncome - totalExpense).toFixed(2)}

Detalhes:
${records
  .map(
    (r: any) =>
      `${r.date} | ${r.category} | ${r.description} | R$ ${Number(r.amount).toFixed(2)} | ${
        r.type === "income" ? "Receita" : "Despesa"
      }`
  )
  .join("\n")}`;

      answer = await groqChat(
        `Pergunta do morador: "${question}"\n\n${financialContext}\n\nResponda a pergunta baseado EXCLUSIVAMENTE nos dados acima. Use formatação Markdown. Mostre valores em reais (R$). Nunca invente dados.`,
        "Você é o CondoAgent, assistente financeiro de um condomínio. Responda de forma clara e precisa baseado nos dados fornecidos.",
        { model: MODEL_CHAT }
      );
    } else {
      const keywordsPrompt = `Extraia as 3-5 palavras-chave mais importantes da seguinte pergunta para buscar em documentos de um condomínio.
Responda APENAS com as palavras separadas por vírgula, sem explicação.

Pergunta: "${question}"`;

      const keywordsRaw = await groqChat(keywordsPrompt, undefined, { model: MODEL_FAST, maxTokens: 60 });
      const searchTerms = keywordsRaw
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 2)
        .join(" OR ");

      const { rows: matches } = await query(
        `SELECT id, content, metadata FROM knowledge_base
         WHERE condo_id = $1 AND search_vector @@ websearch_to_tsquery('portuguese', $2)
         ORDER BY ts_rank(search_vector, websearch_to_tsquery('portuguese', $2)) DESC
         LIMIT 4`,
        [user.condo_id, searchTerms || question]
      );

      if (matches.length === 0) {
        answer = "Não encontrei informações relevantes na base de conhecimento do seu condomínio sobre essa pergunta.";
      } else {
        const context = matches
          .map((m: any, i: number) => `[Trecho ${i + 1}]\n${String(m.content).slice(0, 1500)}`)
          .join("\n\n");

        answer = await groqChat(
          `Pergunta do morador: "${question}"\n\nContexto dos documentos do condomínio:\n${context}\n\nResponda a pergunta baseado EXCLUSIVAMENTE no contexto acima. Se a informação não estiver no contexto, diga que não encontrou a informação. Use formatação Markdown.`,
          "Você é o CondoAgent, assistente de um condomínio. Responda de forma clara, educada e precisa baseado nos documentos fornecidos.",
          { model: MODEL_CHAT }
        );
      }
    }

    res.json({ answer, intent });
  } catch (e: any) {
    console.error("chat error:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;

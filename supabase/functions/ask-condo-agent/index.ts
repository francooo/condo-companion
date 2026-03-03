import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

async function geminiChat(prompt: string, systemInstruction?: string): Promise<string> {
  const contents = [{ role: "user", parts: [{ text: prompt }] }];
  const body: any = { contents };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("Gemini error:", err);
    throw new Error("Gemini API error");
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text }] },
      }),
    }
  );

  if (!res.ok) throw new Error("Embedding generation failed");
  const data = await res.json();
  return data.embedding.values;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { question, condo_id, user_id } = await req.json();
    if (!question) throw new Error("Question is required");
    if (!condo_id) throw new Error("condo_id is required");
    if (!user_id) throw new Error("user_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate user belongs to the condo
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("condo_id, role, active")
      .eq("id", user_id)
      .single();

    if (profileError || !profile) throw new Error("Perfil não encontrado");
    if (!profile.active) throw new Error("Conta desativada");
    if (profile.condo_id !== condo_id) throw new Error("Acesso negado: usuário não pertence a este condomínio");

    // Intent classification
    const classificationPrompt = `Classifique a seguinte pergunta de um morador de condomínio em uma das duas categorias:
- "regras" — se a pergunta é sobre regras, regulamentos, convivência, normas do condomínio
- "financeiro" — se a pergunta é sobre finanças, gastos, receitas, prestação de contas, valores, despesas

Responda APENAS com a palavra "regras" ou "financeiro", sem explicação adicional.

Pergunta: "${question}"`;

    const intent = (await geminiChat(classificationPrompt)).trim().toLowerCase();
    console.log("Intent classified as:", intent);

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

      const filtersRaw = await geminiChat(extractPrompt);
      let filters: any = {};
      try {
        const jsonMatch = filtersRaw.match(/\{[\s\S]*\}/);
        if (jsonMatch) filters = JSON.parse(jsonMatch[0]);
      } catch {
        console.log("Could not parse filters, using fallback");
      }

      let query = supabase
        .from("financial_records")
        .select("*")
        .eq("condo_id", condo_id)
        .order("date", { ascending: false })
        .limit(50);

      if (filters.category) query = query.ilike("category", `%${filters.category}%`);
      if (filters.type === "income" || filters.type === "expense") query = query.eq("type", filters.type);
      if (filters.months) {
        const d = new Date();
        d.setMonth(d.getMonth() - parseInt(filters.months));
        query = query.gte("date", d.toISOString().split("T")[0]);
      }
      if (filters.year) {
        query = query.gte("date", `${filters.year}-01-01`).lte("date", `${filters.year}-12-31`);
      }

      const { data: records, error: dbError } = await query;
      if (dbError) throw dbError;

      const totalIncome = (records || []).filter(r => r.type === "income").reduce((s, r) => s + Number(r.amount), 0);
      const totalExpense = (records || []).filter(r => r.type === "expense").reduce((s, r) => s + Number(r.amount), 0);

      const financialContext = `Dados financeiros encontrados (${records?.length || 0} registros):
Total receitas: R$ ${totalIncome.toFixed(2)}
Total despesas: R$ ${totalExpense.toFixed(2)}
Saldo: R$ ${(totalIncome - totalExpense).toFixed(2)}

Detalhes:
${(records || []).map(r => `${r.date} | ${r.category} | ${r.description} | R$ ${Number(r.amount).toFixed(2)} | ${r.type === "income" ? "Receita" : "Despesa"}`).join("\n")}`;

      answer = await geminiChat(
        `Pergunta do morador: "${question}"\n\n${financialContext}\n\nResponda a pergunta baseado EXCLUSIVAMENTE nos dados acima. Use formatação Markdown. Mostre valores em reais (R$). Nunca invente dados.`,
        "Você é o CondoAgent, assistente financeiro de um condomínio. Responda de forma clara e precisa baseado nos dados fornecidos."
      );
    } else {
      const embedding = await generateEmbedding(question);

      const { data: matches, error: matchError } = await supabase.rpc("match_knowledge_base", {
        query_embedding: JSON.stringify(embedding),
        match_threshold: 0.3,
        match_count: 5,
        filter_condo_id: condo_id,
      });

      if (matchError) {
        console.error("Match error:", matchError);
        throw matchError;
      }

      if (!matches || matches.length === 0) {
        answer = "Não encontrei informações relevantes na base de conhecimento do seu condomínio sobre essa pergunta.";
      } else {
        const context = matches
          .map((m: any, i: number) => `[Trecho ${i + 1} - Similaridade: ${(m.similarity * 100).toFixed(1)}%]\n${m.content}`)
          .join("\n\n");

        answer = await geminiChat(
          `Pergunta do morador: "${question}"\n\nContexto dos documentos do condomínio:\n${context}\n\nResponda a pergunta baseado EXCLUSIVAMENTE no contexto acima. Se a informação não estiver no contexto, diga que não encontrou a informação. Use formatação Markdown.`,
          "Você é o CondoAgent, assistente de um condomínio. Responda de forma clara, educada e precisa baseado nos documentos fornecidos."
        );
      }
    }

    return new Response(JSON.stringify({ answer, intent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ask-condo-agent error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

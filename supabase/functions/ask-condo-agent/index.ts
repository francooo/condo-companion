import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

async function groqChat(prompt: string, systemInstruction?: string): Promise<string> {
  const messages: any[] = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  messages.push({ role: "user", content: prompt });

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("GROQ error:", err);
    throw new Error(`GROQ API error: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
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

    // Intent classification using GROQ
    const classificationPrompt = `Classifique a seguinte pergunta de um morador de condomínio em uma das duas categorias:
- "regras" — se a pergunta é sobre regras, regulamentos, convivência, normas do condomínio
- "financeiro" — se a pergunta é sobre finanças, gastos, receitas, prestação de contas, valores, despesas

Responda APENAS com a palavra "regras" ou "financeiro", sem explicação adicional.

Pergunta: "${question}"`;

    const intent = (await groqChat(classificationPrompt)).trim().toLowerCase();
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

      const filtersRaw = await groqChat(extractPrompt);
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

      const totalIncome = (records || []).filter((r: any) => r.type === "income").reduce((s: number, r: any) => s + Number(r.amount), 0);
      const totalExpense = (records || []).filter((r: any) => r.type === "expense").reduce((s: number, r: any) => s + Number(r.amount), 0);

      const financialContext = `Dados financeiros encontrados (${records?.length || 0} registros):
Total receitas: R$ ${totalIncome.toFixed(2)}
Total despesas: R$ ${totalExpense.toFixed(2)}
Saldo: R$ ${(totalIncome - totalExpense).toFixed(2)}

Detalhes:
${(records || []).map((r: any) => `${r.date} | ${r.category} | ${r.description} | R$ ${Number(r.amount).toFixed(2)} | ${r.type === "income" ? "Receita" : "Despesa"}`).join("\n")}`;

      answer = await groqChat(
        `Pergunta do morador: "${question}"\n\n${financialContext}\n\nResponda a pergunta baseado EXCLUSIVAMENTE nos dados acima. Use formatação Markdown. Mostre valores em reais (R$). Nunca invente dados.`,
        "Você é o CondoAgent, assistente financeiro de um condomínio. Responda de forma clara e precisa baseado nos dados fornecidos."
      );
    } else {
      // Text-based search using GROQ for keyword extraction + ILIKE
      const keywordsPrompt = `Extraia as 3-5 palavras-chave mais importantes da seguinte pergunta para buscar em documentos de um condomínio.
Responda APENAS com as palavras separadas por vírgula, sem explicação.

Pergunta: "${question}"`;

      const keywordsRaw = await groqChat(keywordsPrompt);
      const keywords = keywordsRaw.split(",").map((k: string) => k.trim().toLowerCase()).filter((k: string) => k.length > 2);
      console.log("Extracted keywords:", keywords);

      // Search knowledge base using text matching
      let allMatches: any[] = [];
      for (const keyword of keywords) {
        const { data: matches } = await supabase
          .from("knowledge_base")
          .select("id, content, metadata")
          .eq("condo_id", condo_id)
          .ilike("content", `%${keyword}%`)
          .limit(10);

        if (matches) allMatches.push(...matches);
      }

      // Deduplicate by id
      const seen = new Set<string>();
      const uniqueMatches = allMatches.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      }).slice(0, 8);

      if (uniqueMatches.length === 0) {
        answer = "Não encontrei informações relevantes na base de conhecimento do seu condomínio sobre essa pergunta.";
      } else {
        const context = uniqueMatches
          .map((m: any, i: number) => `[Trecho ${i + 1}]\n${m.content}`)
          .join("\n\n");

        answer = await groqChat(
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

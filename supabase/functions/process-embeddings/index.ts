import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { chunks, metadata, condo_id } = await req.json();
    if (!condo_id) throw new Error("condo_id é obrigatório");

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const records = [];

    for (const chunk of chunks) {
      const embResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "models/text-embedding-004",
            content: { parts: [{ text: chunk }] },
          }),
        }
      );

      if (!embResponse.ok) {
        const errText = await embResponse.text();
        console.error("Embedding error:", errText);
        throw new Error("Failed to generate embedding");
      }

      const embData = await embResponse.json();
      const embedding = embData.embedding.values;

      records.push({
        content: chunk,
        metadata,
        embedding: JSON.stringify(embedding),
        condo_id,
      });
    }

    const { error } = await supabase.from("knowledge_base").insert(records);
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, count: records.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-embeddings error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

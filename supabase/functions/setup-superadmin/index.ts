import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Only allow setup if NO users exist
    const { data: existingUsers } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (existingUsers && existingUsers.users && existingUsers.users.length > 0) {
      return new Response(
        JSON.stringify({ error: "Setup já realizado. Já existem usuários no sistema." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, password, full_name } = await req.json();

    if (!email || !password) {
      throw new Error("E-mail e senha são obrigatórios.");
    }

    // Create superadmin user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || "Superadmin" },
    });
    if (createError) throw createError;

    // Update profile to superadmin
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ role: "superadmin", full_name: full_name || "Superadmin" })
      .eq("id", newUser.user.id);
    if (profileError) throw profileError;

    return new Response(
      JSON.stringify({ success: true, message: "Superadmin criado com sucesso!" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("setup-superadmin error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

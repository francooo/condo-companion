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

    // Get calling user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user: caller } } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!caller) throw new Error("Não autenticado");

    // Get caller profile
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role, condo_id")
      .eq("id", caller.id)
      .single();

    if (!callerProfile) throw new Error("Perfil não encontrado");

    const { action, email, password, full_name, condo_id } = await req.json();

    if (action === "create_admin") {
      if (callerProfile.role !== "superadmin") throw new Error("Apenas superadmin pode criar admins");

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createError) throw createError;

      // Update profile with condo_id and admin role
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ condo_id, role: "admin", full_name })
        .eq("id", newUser.user.id);
      if (profileError) throw profileError;

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_resident") {
      if (callerProfile.role !== "admin" && callerProfile.role !== "superadmin") {
        throw new Error("Apenas admin pode criar moradores");
      }

      const targetCondoId = callerProfile.role === "superadmin" ? condo_id : callerProfile.condo_id;

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createError) throw createError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ condo_id: targetCondoId, role: "resident", full_name })
        .eq("id", newUser.user.id);
      if (profileError) throw profileError;

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Ação inválida");
  } catch (e) {
    console.error("manage-users error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

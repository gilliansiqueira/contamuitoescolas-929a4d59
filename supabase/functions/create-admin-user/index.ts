import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, password, role = "admin", school_id = null } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "email e password obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "senha deve ter no mínimo 6 caracteres" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["admin", "cliente"].includes(role)) {
      return new Response(JSON.stringify({ error: "role inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (role === "cliente" && !school_id) {
      return new Response(JSON.stringify({ error: "cliente precisa de school_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Valida que o chamador é admin (exceto se ainda não houver nenhum admin no sistema — bootstrap)
    const authHeader = req.headers.get("Authorization");
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { count: adminCount } = await adminClient
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    if ((adminCount ?? 0) > 0) {
      // Já existe admin — exige autenticação de admin
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "não autorizado" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user: caller } } = await userClient.auth.getUser();
      if (!caller) {
        return new Response(JSON.stringify({ error: "sessão inválida" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: callerRoles } = await adminClient
        .from("user_roles").select("role").eq("user_id", caller.id);
      if (!callerRoles?.some(r => r.role === "admin")) {
        return new Response(JSON.stringify({ error: "apenas admins podem criar usuários" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 1. Cria usuário (email_confirm para login imediato)
    const { data: created, error: cErr } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { school_id: role === "cliente" ? school_id : null },
    });
    if (cErr) throw cErr;
    const userId = created.user!.id;

    // 2. Garante profile (trigger handle_new_user pode já ter criado)
    await adminClient.from("profiles").upsert(
      { user_id: userId, email, school_id: role === "cliente" ? school_id : null },
      { onConflict: "user_id" },
    );

    // 3. Insere role
    const { error: rErr } = await adminClient.from("user_roles").insert({ user_id: userId, role });
    if (rErr && !rErr.message.includes("duplicate")) throw rErr;

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

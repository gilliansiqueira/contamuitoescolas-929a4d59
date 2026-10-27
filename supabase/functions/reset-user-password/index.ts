import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { canManageCollaborator } from "../_shared/collaboratorAccess.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, password } = await req.json();
    if (!user_id || !password) {
      return new Response(JSON.stringify({ error: "user_id e password obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "senha deve ter no mínimo 6 caracteres" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
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
    const isSuper = !!callerRoles?.some((r) => r.role === "super_admin");
    const isTeam = isSuper || !!callerRoles?.some((r) => r.role === "admin");
    let allowed = isSuper || caller.id === user_id;
    if (!allowed && isTeam) {
      // Equipe: só clientes com alguma empresa da carteira dela.
      const { data: targetRoles } = await adminClient.from("user_roles").select("role").eq("user_id", user_id);
      const { data: permissions } = await adminClient.from("user_permissions").select("permission").eq("user_id", caller.id);
      allowed = canManageCollaborator((callerRoles ?? []).map(r => r.role), (permissions ?? []).map(p => p.permission), (targetRoles ?? []).map(r => r.role));
      const targetIsClient = !targetRoles?.some((r) => r.role === "admin" || r.role === "super_admin");
      if (targetIsClient) {
        const [{ data: prof }, { data: extras }] = await Promise.all([
          adminClient.from("profiles").select("school_id").eq("user_id", user_id).maybeSingle(),
          adminClient.from("user_schools").select("school_id").eq("user_id", user_id),
        ]);
        const ids = [prof?.school_id, ...(extras ?? []).map((e) => e.school_id)].filter(Boolean);
        for (const sid of ids) {
          const { data: ok } = await userClient.rpc("admin_manages_school", { _school_id: sid });
          if (ok) { allowed = true; break; }
        }
      }
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "você só pode alterar a sua senha ou a de clientes da sua carteira" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: uErr } = await adminClient.auth.admin.updateUserById(user_id, { password });
    if (uErr) {
      let msg = uErr.message || "erro ao alterar senha";
      const code = (uErr as any).code || "";
      if (code === "weak_password" || /pwned|leaked|compromised|weak/i.test(msg)) {
        msg = "Senha rejeitada: foi encontrada em vazamentos públicos ou é muito fraca. Use uma senha diferente (combine letras, números e símbolos).";
      } else if (/same.*password|should be different/i.test(msg)) {
        msg = "A nova senha deve ser diferente da senha atual.";
      }
      return new Response(JSON.stringify({ error: msg, code }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("user_access_changes").insert({ actor_id: caller.id, target_user_id: user_id, action: "alterou_senha" });
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

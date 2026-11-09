import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { canManageCollaborator } from "../_shared/collaboratorAccess.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, email: rawEmail } = await req.json();
    const email = String(rawEmail ?? "").trim().toLowerCase();
    if (!user_id || !email) {
      return new Response(JSON.stringify({ error: "user_id e e-mail obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
      return new Response(JSON.stringify({ error: "E-mail inválido" }), {
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
      return new Response(JSON.stringify({ error: "sem permissão para editar este usuário" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: old } = await adminClient.from("profiles").select("email").eq("user_id", user_id).maybeSingle();
    const { data: taken } = await adminClient.from("profiles").select("user_id").ilike("email", email).neq("user_id", user_id).maybeSingle();
    if (taken) {
      return new Response(JSON.stringify({ error: "E-mail já está em uso por outro usuário" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { error: uErr } = await adminClient.auth.admin.updateUserById(user_id, { email, email_confirm: true });
    if (uErr) {
      const msg = /already|registered|exists/i.test(uErr.message) ? "E-mail já está em uso por outro usuário" : uErr.message;
      return new Response(JSON.stringify({ error: msg }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    await adminClient.from("profiles").update({ email }).eq("user_id", user_id);
    await adminClient.from("user_access_changes").insert({ actor_id: caller.id, target_user_id: user_id, action: `alterou_email: ${old?.email ?? "?"} -> ${email}` });
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

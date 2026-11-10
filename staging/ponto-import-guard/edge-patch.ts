// Substituto de importReport em supabase/functions/pontofopag-sync/index.ts (PROMOÇÃO FUTURA).
// O chamador (Deno.serve) já confirmou sessão + is_super_admin() antes de chegar aqui.
// Copiar validate.ts para supabase/functions/pontofopag-sync/validate.ts ao promover.
import { validateReport, idempotencyKey, type Row } from "./validate.ts";
// deno-lint-ignore no-explicit-any
type Admin = any;
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } });

export async function importReport(body: Row, admin: Admin, userId: string) {
  const v = validateReport(body);
  if (!v.ok) return json({ status: "error", error: "Relatório bloqueado.", errors: v.errors.slice(0, 50) }, 400);
  const key = await idempotencyKey(v.plan);
  const payload = { idempotency_key: key, requested_by: userId, arquivo: v.plan.arquivo, periodoInicio: v.plan.periodoInicio, periodoFim: v.plan.periodoFim,
    employees: v.plan.employees, daily: v.plan.daily, occurrences: v.plan.occurrences };
  const { data, error } = await admin.rpc("team_time_import_report", { p: payload });
  if (error) {
    // Transação desfeita por inteiro. Registra a falha; se esse registro falhar, informa também.
    const log = await admin.from("team_time_sync_runs").insert({ trigger: "relatorio_pdf", status: "error", requested_by: userId, reference_date: v.plan.periodoFim, finished_at: new Date().toISOString(), message: String(error.message ?? "Erro").slice(0, 300) });
    return json({ status: "error", message: "Nada foi gravado: " + (error.message ?? "erro"), idempotency_key: key, log_error: log.error?.message ?? null }, 500);
  }
  return json({ ...data, idempotency_key: key });
}

/** Ação "import_status": após timeout, o navegador pergunta se a chave já foi gravada, em vez de reenviar às cegas. */
export async function importStatus(body: Row, admin: Admin) {
  const key = typeof body.idempotency_key === "string" && /^[0-9a-f]{64}$/.test(body.idempotency_key) ? body.idempotency_key : null;
  if (!key) return json({ error: "Chave inválida." }, 400);
  const { data, error } = await admin.from("team_time_sync_runs").select("id,counts,finished_at").eq("idempotency_key", key).eq("status", "success").maybeSingle();
  if (error) return json({ error: error.message }, 500);
  return json(data ? { status: "success", replay: true, counts: data.counts } : { status: "not_found" });
}

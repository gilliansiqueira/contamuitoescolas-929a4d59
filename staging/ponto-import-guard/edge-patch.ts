// Substituto de importReport em supabase/functions/pontofopag-sync/index.ts (PROMOÇÃO FUTURA — não aplicado).
// Copiar validate.ts junto. Nunca registra/retorna error.message bruto (pode conter dados); só códigos.
import { validateReport, contentHash, type Row } from "./validate.ts";

export interface Resp { status: number; body: Record<string, unknown> }
export interface DbErr { code?: string; message?: string }
export interface AdminPort {
  rpcImport(p: Record<string, unknown>): Promise<{ data: Record<string, unknown> | null; error: DbErr | null }>;
  findAttempt(attemptId: string): Promise<{ data: { content_hash: string | null; counts: unknown } | null; error: DbErr | null }>;
  logRun(row: Record<string, unknown>): Promise<{ error: DbErr | null }>;
}
export interface AuthPort { userId(): Promise<string | null>; isSuperAdmin(): Promise<boolean> }

/** Lista CONSERVADORA de rejeições determinísticas (a instrução falhou antes do commit):
 *  22xxx dados inválidos, 23xxx restrição, 42xxx sintaxe/permissão, P0001 RAISE da própria função.
 *  Qualquer outro código (classe 08 conexão, 08007, 40003, 57xxx cancelamento, desconhecidos) => incerto: consulta a tentativa. */
const DETERMINISTIC = /^(22[0-9A-Z]{3}|23[0-9A-Z]{3}|42[0-9A-Z]{3}|P0001)$/;
export const isDeterministicRejection = (e: DbErr | null | undefined) => !!e?.code && DETERMINISTIC.test(e.code);

async function confirm(admin: AdminPort, attemptId: string, hash: string): Promise<Resp> {
  try {
    const { data, error } = await admin.findAttempt(attemptId);
    if (error) return uncertain(attemptId, "consulta_indisponivel");
    if (data && data.content_hash === hash) return { status: 200, body: { status: "success", replay: true, confirmed_after_error: true, attempt_id: attemptId, counts: data.counts } };
    if (data) return { status: 409, body: { status: "error", code: "attempt_conflict", attempt_id: attemptId, message: "Esta tentativa já foi gravada com outro conteúdo." } };
    return uncertain(attemptId, "tentativa_nao_encontrada");
  } catch { return uncertain(attemptId, "consulta_indisponivel"); }
}
const uncertain = (attemptId: string, reason: string): Resp => ({ status: 202, body: { status: "uncertain", reason, attempt_id: attemptId,
  message: "Não foi possível confirmar se a importação foi gravada. Consulte o status com a mesma tentativa; não reenvie com outra." } });

export async function importReport(body: Row, admin: AdminPort, userId: string): Promise<Resp> {
  const v = validateReport(body);
  if (!v.ok) return { status: 400, body: { status: "error", code: "validation", errors: v.errors.slice(0, 50) } };
  const hash = await contentHash(v.plan), attemptId = v.plan.attemptId;
  const payload = { attempt_id: attemptId, content_hash: hash, requested_by: userId, arquivo: v.plan.arquivo, periodoInicio: v.plan.periodoInicio,
    periodoFim: v.plan.periodoFim, employees: v.plan.employees, daily: v.plan.daily, occurrences: v.plan.occurrences };
  let res: Awaited<ReturnType<AdminPort["rpcImport"]>>;
  try { res = await admin.rpcImport(payload); }
  catch { return confirm(admin, attemptId, hash); } // exceção lançada (rede/timeout): pode ter commitado
  if (!res.error && res.data?.status === "success") return { status: 200, body: { ...res.data, attempt_id: attemptId } };
  if (!isDeterministicRejection(res.error)) return confirm(admin, attemptId, hash);
  // Rejeição determinística => transação desfeita. Registra só o código.
  const code = res.error!.code!;
  let logFailed = false;
  try { const l = await admin.logRun({ trigger: "relatorio_pdf", status: "error", requested_by: userId, reference_date: v.plan.periodoFim, finished_at: new Date().toISOString(), message: `rpc_error:${code}` }); logFailed = !!l.error; }
  catch { logFailed = true; }
  return { status: 422, body: { status: "error", code: "db_rejected", sqlstate: code, rolled_back: true, attempt_id: attemptId, log_failed: logFailed, message: "O banco recusou a importação; nada foi gravado." } };
}

export async function importStatus(body: Row, admin: AdminPort): Promise<Resp> {
  const id = body && typeof body.attempt_id === "string" && /^[0-9a-f-]{36}$/i.test(body.attempt_id) ? body.attempt_id : null;
  if (!id) return { status: 400, body: { status: "error", code: "invalid_attempt" } };
  try {
    const { data, error } = await admin.findAttempt(id);
    if (error) return { status: 503, body: { status: "unknown", attempt_id: id } };
    return { status: 200, body: data ? { status: "success", attempt_id: id, content_hash: data.content_hash, counts: data.counts } : { status: "not_found", attempt_id: id } };
  } catch { return { status: 503, body: { status: "unknown", attempt_id: id } }; }
}

/** Invólucro documentado: sessão + super_admin antes de qualquer acesso ao banco. */
export async function handle(body: unknown, auth: AuthPort, admin: AdminPort): Promise<Resp> {
  let uid: string | null = null, ok = false;
  try { uid = await auth.userId(); if (uid) ok = await auth.isSuperAdmin(); } catch { return { status: 401, body: { error: "Não autenticado." } }; }
  if (!uid) return { status: 401, body: { error: "Não autenticado." } };
  if (!ok) return { status: 403, body: { error: "Acesso restrito." } };
  const b = (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as Row;
  if (b.action === "import_report") { const { action: _a, ...rest } = b; return importReport(rest, admin, uid); }
  if (b.action === "import_status") return importStatus(b, admin);
  return { status: 400, body: { error: "Ação inválida." } };
}

/* Ligação real (na promoção), dentro de Deno.serve:
const port: AdminPort = {
  rpcImport: (p) => admin.rpc("team_time_import_report", { p }),
  findAttempt: (id) => admin.from("team_time_sync_runs").select("content_hash,counts").eq("attempt_id", id).eq("status", "success").maybeSingle(),
  logRun: (row) => admin.from("team_time_sync_runs").insert(row),
};
const authPort: AuthPort = { userId: async () => (await userClient.auth.getUser()).data.user?.id ?? null, isSuperAdmin: async () => !!(await userClient.rpc("is_super_admin")).data };
const r = await handle(await req.json().catch(() => null), authPort, port); return json(r.body, r.status);
*/

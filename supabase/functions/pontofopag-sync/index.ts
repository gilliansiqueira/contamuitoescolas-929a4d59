// Ponto da Equipe — sincronização SOMENTE LEITURA com a API PontoFopag.
// Fluxo: PontoFopag API → esta função → tabelas team_time_* → painel (somente super_admin).
// Nenhuma chamada de escrita (POST de cadastro, DELETE) é feita ao PontoFopag.
// Os endpoints "Relatorio*" usam POST apenas porque a API recebe os filtros no corpo; eles não alteram dados.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

// A documentação (api.pontofopag.com.br/Help) não descreve o método de autenticação.
// A API responde 401 com "WWW-Authenticate: Bearer", então o adaptador envia "Authorization: Bearer <token>".
// A forma de obter o token precisa ser confirmada com a Employer/ePays.
const BASE = (Deno.env.get("PONTOFOPAG_BASE_URL") ?? "https://api.pontofopag.com.br").replace(/\/$/, "");
const TOKEN = Deno.env.get("PONTOFOPAG_API_TOKEN");

type Row = Record<string, unknown>;
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
function pick(o: Row, keys: string[]): string | undefined {
  const map = new Map(Object.keys(o).map(k => [norm(k), k]));
  for (const k of keys) { const real = map.get(norm(k)); if (real && o[real] != null && String(o[real]).trim() !== "") return String(o[real]).trim(); }
  return undefined;
}
const asRows = (d: unknown): Row[] => Array.isArray(d) ? d as Row[] : d && typeof d === "object"
  ? (Object.values(d as Row).find(Array.isArray) as Row[] | undefined) ?? [] : [];

function spDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 864e5);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d); // yyyy-mm-dd
}
const br = (iso: string) => iso.split("-").reverse().join("/");
function toIso(v?: string) {
  if (!v) return undefined;
  const m = v.match(/(\d{2})\/(\d{2})\/(\d{4})/); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const i = v.match(/(\d{4})-(\d{2})-(\d{2})/); return i ? i[0] : undefined;
}
function minutes(v?: string) {
  if (!v) return null; const m = v.match(/(-)?(\d+):(\d{2})/); if (!m) return null;
  return (m[1] ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

async function call(path: string, init: RequestInit, runId: string, admin: ReturnType<typeof createClient>) {
  const res = await fetch(`${BASE}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) {
    // Nunca registra token nem corpo enviado; só status e um trecho da resposta.
    await admin.from("team_time_sync_errors").insert({ run_id: runId, endpoint: path.split("?")[0], http_status: res.status, message: text.slice(0, 300) || res.statusText });
    throw new Error(`${path.split("?")[0]} respondeu ${res.status}`);
  }
  try { return JSON.parse(text); } catch { return []; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Somente super_admin (validado no servidor com o token da sessão).
  const auth = req.headers.get("Authorization") ?? "";
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ error: "Não autenticado." }, 401);
  const { data: isSuper } = await userClient.rpc("is_super_admin");
  if (!isSuper) return json({ error: "Acesso restrito." }, 403);

  const today = spDate();
  const monthStart = today.slice(0, 8) + "01";

  if (!TOKEN) {
    await admin.from("team_time_sync_runs").insert({ trigger: "manual", status: "not_configured", requested_by: u.user.id, reference_date: today, finished_at: new Date().toISOString(), message: "Credencial da API PontoFopag ainda não configurada." });
    return json({ configured: false });
  }

  const { data: run } = await admin.from("team_time_sync_runs").insert({ trigger: "manual", status: "running", requested_by: u.user.id, reference_date: today }).select("id").single();
  const runId = run!.id as string;

  try {
    // 1) Funcionários ativos, não excluídos
    const funcs = asRows(await call("api/Funconario/GetAllFuncs?ativo=1&excluido=0", { method: "GET" }, runId, admin));
    const employees = funcs.map(f => {
      const matricula = pick(f, ["Matricula", "DsCodigo", "Codigo"]);
      const external = pick(f, ["IdIntegracao", "Id", "IdFuncionario"]) ?? matricula;
      return external ? {
        external_id: external, matricula: matricula ?? null, nome: pick(f, ["Nome", "NomeFuncionario"]) ?? "Sem nome",
        cargo: pick(f, ["Funcao", "Cargo"]) ?? null, departamento: pick(f, ["Departamento"]) ?? null,
        horario_previsto: pick(f, ["Horario", "DescricaoHorario"]) ?? null, ativo: true, synced_at: new Date().toISOString(),
      } : null;
    }).filter(Boolean) as Row[];
    if (employees.length) await admin.from("team_time_employees").upsert(employees, { onConflict: "external_id" });
    const byMat = new Map(employees.map(e => [String(e.matricula ?? e.external_id), String(e.external_id)]));
    // CPF é usado apenas se a API exigir; não é gravado. Aqui enviamos só a matrícula.
    const cpfsMatriculas = employees.map(e => ({ CPF: "", Matricula: String(e.matricula ?? "") }));
    const empOf = (r: Row) => byMat.get(pick(r, ["Matricula", "DsCodigo"]) ?? "") ?? pick(r, ["IdIntegracao", "IdFuncionario"]);

    const period = { InicioPeriodo: br(monthStart), FimPeriodo: br(today), CPFsMatriculas: cpfsMatriculas };

    // 2) Ocorrências oficiais do mês (fonte da classificação atraso/falta etc.)
    const occ = asRows(await call("api/RelatorioOcorrencias", { method: "POST", body: JSON.stringify({ ...period, EntradaAtrasada: true, SaidaAntecipada: true, Falta: true, DebitoBH: true, Ocorrencia: true, MarcacoesIncorretas: true, HorasExtras: true, Atraso: true, Justificativa: true, IdsOcorrencias: [], IdsJustificativas: [] }) }, runId, admin));
    // 3) Inconsistências
    const inc = asRows(await call("api/RelatorioInconsistencias", { method: "POST", body: JSON.stringify({ ...period, Interjornada: true, Intrajornada: true, SetimoDiaTrabalhado: true, LimiteHorasTrabalhadas: true, TerceiroDomTrabalhado: true, SeisHorasSemIntervalo: true }) }, runId, admin));
    const occRows = [...occ.map(r => ({ r, origem: "ocorrencias" })), ...inc.map(r => ({ r, origem: "inconsistencias" }))].map(({ r, origem }) => {
      const emp = empOf(r); const dia = toIso(pick(r, ["Data", "DataMarcacao", "Dia"]));
      const tipo = pick(r, ["Tipo", "Ocorrencia", "Inconsistencia", "Descricao"]) ?? origem;
      return emp && dia ? { external_key: `${origem}|${emp}|${dia}|${norm(tipo)}`, employee_external_id: emp, dia, tipo, descricao: pick(r, ["Descricao", "Observacao"]) ?? null, origem, synced_at: new Date().toISOString() } : null;
    }).filter(Boolean) as Row[];
    if (occRows.length) await admin.from("team_time_occurrences").upsert(occRows, { onConflict: "external_key" });

    // 4) Tratamento de ponto (marcações do dia)
    const trat = asRows(await call("api/RelatorioTratamentoDePonto", { method: "POST", body: JSON.stringify({ ...period, InicioPeriodo: br(today) }) }, runId, admin));
    const daily = trat.map(r => {
      const emp = empOf(r); const dia = toIso(pick(r, ["Data", "Dia"])) ?? today; if (!emp) return null;
      const marc = ["Entrada1", "Saida1", "Entrada2", "Saida2", "Entrada3", "Saida3", "Entrada4", "Saida4"].map(k => pick(r, [k])).filter(Boolean) as string[];
      const oficiais = occRows.filter(o => o.employee_external_id === emp && o.dia === dia).map(o => norm(String(o.tipo)));
      const has = (s: string) => oficiais.some(t => t.includes(s));
      // Classificação somente a partir da informação oficial; sem dados suficientes → aguardando.
      const situacao = has("falta") ? "falta" : has("atras") ? "atraso" : has("incorret") || has("incomplet") ? "incompleta"
        : oficiais.some(t => t.includes("jornada") || t.includes("intervalo") || t.includes("limite")) ? "inconsistencia"
        : has("extra") ? "hora_extra" : marc.length === 0 ? "sem_marcacao" : marc.length % 2 === 0 && oficiais.length === 0 ? "regular" : "aguardando";
      return { employee_external_id: emp, dia, horario_previsto: pick(r, ["Horario", "HorarioPrevisto"]) ?? null, primeira_marcacao: marc[0] ?? null, ultima_marcacao: marc.length > 1 ? marc[marc.length - 1] : null, marcacoes: marc, horas_trabalhadas: pick(r, ["HorasTrabalhadas", "Trabalhadas"]) ?? null, horas_extras: pick(r, ["HorasExtras", "Extras"]) ?? null, situacao, ocorrencia: oficiais.length ? occRows.filter(o => o.employee_external_id === emp && o.dia === dia).map(o => o.tipo).join(", ") : null, synced_at: new Date().toISOString() };
    }).filter(Boolean) as Row[];
    if (daily.length) await admin.from("team_time_daily").upsert(daily, { onConflict: "employee_external_id,dia" });

    // 5) Saldo do banco de horas do mês
    const [ano, mes] = today.split("-");
    const bh = asRows(await call("api/RelatorioSaldoBancoHoras", { method: "POST", body: JSON.stringify({ MesInicio: mes, AnoInicio: ano, MesFim: mes, AnoFim: ano, CPFsMatriculas: cpfsMatriculas }) }, runId, admin));
    const bank = bh.map(r => { const emp = empOf(r); const saldo = pick(r, ["Saldo", "SaldoBH", "SaldoAtual"]); return emp ? { employee_external_id: emp, competencia: `${ano}-${mes}`, saldo: saldo ?? null, saldo_minutos: minutes(saldo), synced_at: new Date().toISOString() } : null; }).filter(Boolean) as Row[];
    if (bank.length) await admin.from("team_time_hour_bank").upsert(bank, { onConflict: "employee_external_id,competencia" });

    const counts = { funcionarios: employees.length, ocorrencias: occRows.length, dias: daily.length, banco_horas: bank.length };
    await admin.from("team_time_sync_runs").update({ status: "success", finished_at: new Date().toISOString(), counts }).eq("id", runId);
    return json({ configured: true, status: "success", counts });
  } catch (e) {
    // Falha: não apaga os últimos dados válidos; só registra.
    const message = e instanceof Error ? e.message : "Erro desconhecido";
    await admin.from("team_time_sync_runs").update({ status: "error", finished_at: new Date().toISOString(), message }).eq("id", runId);
    return json({ configured: true, status: "error", message }, 200);
  }
});

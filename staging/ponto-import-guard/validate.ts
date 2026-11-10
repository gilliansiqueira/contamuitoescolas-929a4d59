// Validação estrita do "Relatório de Cartão Ponto" ANTES de qualquer gravação.
// Puro (sem Deno/Node): roda na Edge Function e nos testes. Nunca descarta nem trunca em silêncio.
export type Row = Record<string, unknown>;
export const SITS = ["regular", "sem_marcacao", "incompleta", "falta", "hora_extra", "aguardando", "em_andamento"] as const;
export const MAX_FUNCS = 500, MAX_DIAS_PERIODO = 62, MAX_MARCACOES = 12;
const ISO = /^\d{4}-\d{2}-\d{2}$/, HM = /^\d{1,3}:[0-5]\d$/, MARC = /^([01]\d|2[0-3]):[0-5]\d$/;
const FORBIDDEN_KEYS = /^(cpf|pis|pispasep|pis_pasep|nis|nit|rg|documento)$/i;
// Esquema permitido: qualquer chave fora destas listas bloqueia (evita documentos escondidos em campos novos).
const TOP_KEYS = new Set(["action", "arquivo", "periodoInicio", "periodoFim", "funcionarios", "attempt_id"]);
const FUNC_KEYS = new Set(["codigo", "nome", "matricula", "departamento", "funcao", "dias", "totais"]);
const DIA_KEYS = new Set(["dia", "jornada", "marcacoes", "trabalhadas", "extras", "faltas", "situacao", "observacao"]);
const TOT_KEYS = new Set(["trabalhadas", "extras", "faltas"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ImportPlan {
  attemptId: string; periodoInicio: string; periodoFim: string; arquivo: string | null;
  employees: Row[]; daily: Row[]; occurrences: Row[];
  counts: { funcionarios: number; dias: number; ocorrencias: number };
}
export type ValidationResult = { ok: true; plan: ImportPlan } | { ok: false; errors: string[] };

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
export function isRealDate(s: unknown): s is string {
  if (typeof s !== "string" || !ISO.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`); return !isNaN(+d) && d.toISOString().slice(0, 10) === s;
}
export const toMin = (v: string) => { const [h, m] = v.split(":").map(Number); return h * 60 + m; };
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function checkKeys(o: unknown, allowed: Set<string>, path: string, errs: string[]) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return;
  for (const k of Object.keys(o)) {
    if (FORBIDDEN_KEYS.test(k)) errs.push(`Campo proibido (${k}) em ${path}. CPF/PIS não podem ser enviados.`);
    else if (!allowed.has(k)) errs.push(`Campo não permitido (${k}) em ${path}.`);
  }
}

/** Texto opcional: null se vazio; erro se não for texto ou exceder o limite (sem truncar). */
function text(v: unknown, max: number, label: string, errs: string[]): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string") { errs.push(`${label}: tipo inválido.`); return null; }
  const t = v.trim(); if (!t) return null;
  if (t.length > max) { errs.push(`${label}: texto acima de ${max} caracteres.`); return null; }
  return t;
}
function dur(v: unknown, label: string, errs: string[]): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || !HM.test(v)) { errs.push(`${label}: duração inválida (${String(v)}).`); return null; }
  return v;
}

export function validateReport(body: Row, nowIso = new Date().toISOString()): ValidationResult {
  const errs: string[] = [];
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, errors: ["Corpo da requisição inválido."] };
  checkKeys(body, TOP_KEYS, "relatorio", errs);
  if (!(typeof body.attempt_id === "string" && UUID.test(body.attempt_id))) errs.push("Identificador da tentativa (attempt_id) ausente ou inválido.");
  if (Array.isArray(body.funcionarios)) for (const [i, f] of (body.funcionarios as Row[]).entries()) {
    checkKeys(f, FUNC_KEYS, `funcionario #${i + 1}`, errs); checkKeys(f?.totais, TOT_KEYS, `funcionario #${i + 1}.totais`, errs);
    if (Array.isArray(f?.dias)) (f.dias as Row[]).forEach((d, j) => checkKeys(d, DIA_KEYS, `funcionario #${i + 1}.dias[${j}]`, errs));
  }
  const ini = body.periodoInicio, fim = body.periodoFim;
  if (!isRealDate(ini) || !isRealDate(fim)) errs.push("Período com data inválida.");
  else if (ini > fim) errs.push("Início do período depois do fim.");
  else if ((Date.parse(fim) - Date.parse(ini)) / 864e5 + 1 > MAX_DIAS_PERIODO) errs.push(`Período acima de ${MAX_DIAS_PERIODO} dias.`);
  const funcs = body.funcionarios;
  if (!Array.isArray(funcs) || !funcs.length) errs.push("Nenhum funcionário no relatório.");
  else if (funcs.length > MAX_FUNCS) errs.push(`Mais de ${MAX_FUNCS} funcionários.`);
  const arquivo = text(body.arquivo, 200, "Arquivo", errs);
  if (errs.length) return { ok: false, errors: errs };

  const employees: Row[] = [], daily: Row[] = [], occurrences: Row[] = [];
  const seenEmp = new Set<string>();
  for (const [i, f] of (funcs as Row[]).entries()) {
    const who = `Funcionário #${i + 1}`;
    if (!f || typeof f !== "object") { errs.push(`${who}: formato inválido.`); continue; }
    const codigo = typeof f.codigo === "string" ? f.codigo.trim() : "";
    if (!/^\d{1,20}$/.test(codigo)) { errs.push(`${who}: código inválido.`); continue; }
    const ext = `pf-${codigo}`;
    if (seenEmp.has(ext)) { errs.push(`${who}: código ${codigo} repetido.`); continue; }
    seenEmp.add(ext);
    const nome = text(f.nome, 120, `${who} nome`, errs);
    if (!nome) errs.push(`${who}: nome ausente.`);
    employees.push({ external_id: ext, matricula: text(f.matricula, 20, `${who} matrícula`, errs), nome: nome ?? "", cargo: text(f.funcao, 120, `${who} função`, errs), departamento: text(f.departamento, 120, `${who} departamento`, errs) });

    if (!Array.isArray(f.dias)) { errs.push(`${who}: lista de dias ausente.`); continue; }
    if (!f.dias.length) { errs.push(`${who}: nenhum dia lido no relatório.`); continue; }
    const seenDia = new Set<string>(); const soma = { trabalhadas: 0, extras: 0, faltas: 0 };
    for (const d of f.dias as Row[]) {
      const dia = d?.dia;
      if (!isRealDate(dia)) { errs.push(`${who}: data inválida (${String(dia)}).`); continue; }
      if (dia < (ini as string) || dia > (fim as string)) { errs.push(`${who}: dia ${dia} fora do período.`); continue; }
      if (seenDia.has(dia)) { errs.push(`${who}: dia ${dia} repetido.`); continue; }
      seenDia.add(dia);
      const rawM = d.marcacoes ?? [];
      if (!Array.isArray(rawM)) { errs.push(`${who} ${dia}: marcações inválidas.`); continue; }
      if (rawM.length > MAX_MARCACOES) { errs.push(`${who} ${dia}: ${rawM.length} marcações (máximo ${MAX_MARCACOES}).`); continue; }
      const bad = rawM.filter(m => typeof m !== "string" || !MARC.test(m));
      if (bad.length) { errs.push(`${who} ${dia}: marcação inválida (${bad.map(String).join(", ")}).`); continue; }
      const marc = rawM as string[];
      // Ordem preservada como veio do relatório (jornada noturna pode virar o dia: 22:00, 02:00). Sem reordenar nem rejeitar.
      const sit = d.situacao == null ? "aguardando" : String(d.situacao);
      if (!(SITS as readonly string[]).includes(sit)) { errs.push(`${who} ${dia}: situação inválida (${sit}).`); continue; }
      const L = `${who} ${dia}`;
      const jornada = text(d.jornada, 60, `${L} jornada`, errs), obs = text(d.observacao, 120, `${L} observação`, errs);
      const trab = dur(d.trabalhadas, `${L} trabalhadas`, errs), ext2 = dur(d.extras, `${L} extras`, errs), falt = dur(d.faltas, `${L} faltas`, errs);
      if (trab) soma.trabalhadas += toMin(trab); if (ext2) soma.extras += toMin(ext2); if (falt) soma.faltas += toMin(falt);
      // Dia realmente vazio (sem jornada, batidas, observação nem horas): não grava e NÃO apaga o que já existir.
      // Dia com horas mas sem batidas/jornada é preservado (gravado), nunca descartado.
      if (!jornada && !marc.length && !obs && !trab && !ext2 && !falt) continue;
      daily.push({ employee_external_id: ext, dia, horario_previsto: jornada, primeira_marcacao: marc[0] ?? null, ultima_marcacao: marc.length > 1 ? marc[marc.length - 1] : null, marcacoes: marc, horas_trabalhadas: trab, horas_extras: ext2, situacao: sit, ocorrencia: sit === "em_andamento" ? null : obs ?? (falt ? `Faltas ${falt} (relatório)` : null) });
      if (obs && sit !== "em_andamento") occurrences.push({ external_key: `relatorio_pdf|${ext}|${dia}|${norm(obs)}`, employee_external_id: ext, dia, tipo: obs });
    }
    // Totais impressos conferidos no servidor: ausência ou divergência bloqueia.
    const tot = (f.totais ?? null) as Row | null;
    for (const k of ["trabalhadas", "extras", "faltas"] as const) {
      const t = tot?.[k];
      if (typeof t !== "string" || !HM.test(t)) { errs.push(`${who}: total de ${k} ausente ou inválido.`); continue; }
      if (toMin(t) !== soma[k]) errs.push(`${who}: total de ${k} ${t} difere da soma dos dias ${fmt(soma[k])}.`);
    }
  }
  if (errs.length) return { ok: false, errors: errs };
  void nowIso;
  return { ok: true, plan: { attemptId: body.attempt_id as string, periodoInicio: ini as string, periodoFim: fim as string, arquivo, employees, daily, occurrences, counts: { funcionarios: employees.length, dias: daily.length, ocorrencias: occurrences.length } } };
}

/** Hash do conteúdo: confere que a repetição de uma tentativa traz o MESMO conteúdo (não serve para deduplicar para sempre). */
export function canonicalPlan(p: ImportPlan): string {
  return JSON.stringify({ i: p.periodoInicio, f: p.periodoFim, e: p.employees, d: p.daily, o: p.occurrences });
}
export async function contentHash(p: ImportPlan): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalPlan(p)));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

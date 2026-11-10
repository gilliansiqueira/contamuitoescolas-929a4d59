// @vitest-environment node
// Ponta a ponta SEM servidor real: leitor do PDF (tokens sintéticos) -> mapeamento da tela -> cliente (importClient)
// -> invólucro da função (importGuard/edge-patch) -> RPC no PostgreSQL DESCARTÁVEL com o schema completo.
// Roda só com PGTEST_SOCKET_DIR/PGTEST_PORT apontando para o banco local criado por run.sh.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { parseCartaoPonto, type PdfToken } from "@/lib/teamTime/cartaoPontoParser";
import { runImport, type ClientDeps } from "@/lib/teamTime/importGuard/importClient";
import { handle, type AdminPort, type AuthPort } from "../../../supabase/functions/pontofopag-sync/importGuard";

const DIR = process.env.PGTEST_SOCKET_DIR!, PORT = process.env.PGTEST_PORT!;
if (!DIR?.startsWith("/tmp/") || !PORT) throw new Error("Abortado: banco descartável não informado");
const sql = postgres({ path: `${DIR}/.s.PGSQL.${PORT}`, user: "tester", database: "schema_descartavel", max: 4, onnotice: () => {} });
const SUPER = "00000000-0000-0000-0000-0000000000a1", COMUM = "00000000-0000-0000-0000-0000000000b2";

const line = (page: number, y: number, ...items: [number, string][]): PdfToken[] => items.map(([x, s]) => ({ page, x, y, s }));
const dia = (y: number, d: string, trab: string) => line(1, y, [20, d], [200, "08:00"], [250, "17:00"], [365, trab]);
const tokens = (t2: string, total: string) => [
  ...line(1, 800, [20, "Período de 01/03/2030 à 03/03/2030"]),
  ...line(1, 780, [20, "Funcionário: 900 - PESSOA FICTICIA"]),
  ...dia(700, "01/03/30", "08:00"), ...dia(690, "02/03/30", t2),
  ...line(1, 600, [20, "Trabalhadas"], [100, total]), ...line(1, 590, [20, "Extras"], [100, "00:00"]), ...line(1, 580, [20, "Faltas"], [100, "00:00"]),
];
/** Exatamente o mapeamento do patch em ImportCartaoPonto.tsx. */
function payloadFrom(t: PdfToken[]) {
  const rep = parseCartaoPonto(t);
  expect(rep.divergencias).toEqual([]);
  return { arquivo: "sintetico.pdf", periodoInicio: rep.periodoInicio!, periodoFim: rep.periodoFim!,
    funcionarios: rep.funcionarios.map(({ codigo, nome, matricula, departamento, funcao, dias, totais }) => ({ codigo, nome, matricula, departamento, funcao, dias, totais })) };
}

const port: AdminPort = {
  rpcImport: async (p) => {
    try { const [r] = await sql.begin(async (tx) => { await tx`set local role service_role`; return tx`select public.team_time_import_report(${tx.json(p as never)}) as r`; });
      return { data: r.r, error: null }; }
    catch (e) { return { data: null, error: { code: (e as { code?: string }).code } }; }
  },
  findAttempt: async (id) => { const rows = await sql`select content_hash, counts from public.team_time_sync_runs where attempt_id=${id} and status='success'`; return { data: rows[0] ?? null, error: null }; },
  logRun: async (row) => { await sql`insert into public.team_time_sync_runs ${sql(row as never)}`; return { error: null }; },
};
const auth = (uid: string | null): AuthPort => ({ userId: async () => uid, isSuperAdmin: async () => !!uid && (await sql`select 1 from public.user_roles where user_id=${uid} and role='super_admin'`).length > 0 });
const deps = (uid: string | null, hook?: (b: Record<string, unknown>, r: { status: number; body: Record<string, unknown> }) => void): ClientDeps => {
  let n = 0;
  return { newId: () => crypto.randomUUID(), sleep: async () => {}, invoke: async (b) => { const r = await handle(b, auth(uid), port); n++; hook?.(b, r); if ((b as { __throw?: boolean }).__throw) throw new Error("x"); return r; } };
};
const days = () => sql`select dia::text, horas_trabalhadas from public.team_time_daily d join public.team_time_employees e on e.external_id=d.employee_external_id where e.nome='PESSOA FICTICIA' order by dia`;

beforeAll(async () => {
  const [db] = await sql`select current_database() db, coalesce(inet_server_addr()::text,'socket') addr`;
  if (db.db !== "schema_descartavel" || db.addr !== "socket") throw new Error("Abortado: não é o banco descartável");
  await sql`insert into auth.users(id,email) values (${SUPER},'super@exemplo.test'),(${COMUM},'comum@exemplo.test') on conflict do nothing`;
  await sql`insert into public.user_roles(user_id,role) values (${SUPER},'super_admin'),(${COMUM},'admin') on conflict do nothing`;
});
afterAll(async () => { await sql.end(); });

describe("ponta a ponta com schema completo (sem servidor real)", () => {
  it("sessão expirada: recusa e não grava", async () => {
    const out = await runImport(payloadFrom(tokens("08:00", "16:00")), deps(null));
    expect(out.kind).toBe("rejected"); expect(await days()).toEqual([]);
  });
  it("usuário sem super_admin: recusa e não grava", async () => {
    const out = await runImport(payloadFrom(tokens("08:00", "16:00")), deps(COMUM));
    expect(out.kind).toBe("rejected"); expect(await days()).toEqual([]);
  });
  it("PDF sintético até confirmação: grava 2 dias", async () => {
    const out = await runImport(payloadFrom(tokens("08:00", "16:00")), deps(SUPER));
    expect(out.kind).toBe("success"); expect(await days()).toEqual([{ dia: "2030-03-01", horas_trabalhadas: "08:00" }, { dia: "2030-03-02", horas_trabalhadas: "08:00" }]);
  });
  it("mesmo PDF de novo (duplicação): não duplica dias", async () => {
    const out = await runImport(payloadFrom(tokens("08:00", "16:00")), deps(SUPER));
    expect(out.kind).toBe("success"); expect((await days()).length).toBe(2);
  });
  it("correção: novo PDF com dia alterado atualiza só aquele dia", async () => {
    const out = await runImport(payloadFrom(tokens("07:00", "15:00")), deps(SUPER));
    expect(out.kind).toBe("success"); expect(await days()).toEqual([{ dia: "2030-03-01", horas_trabalhadas: "08:00" }, { dia: "2030-03-02", horas_trabalhadas: "07:00" }]);
  });
  it("timeout depois do commit: confirma pela mesma tentativa, sem segunda gravação", async () => {
    let first = true; const seen: string[] = [];
    const d: ClientDeps = { newId: () => crypto.randomUUID(), sleep: async () => {}, invoke: async (b) => {
      const r = await handle(b, auth(SUPER), port); seen.push(String(b.action));
      if (b.action === "import_report" && first) { first = false; throw new Error("timeout simulado depois do commit"); }
      return r; } };
    const out = await runImport(payloadFrom(tokens("06:00", "14:00")), d);
    expect(out.kind).toBe("success"); expect(out.kind === "success" && out.replay).toBe(true);
    expect(seen[0]).toBe("import_report"); expect(seen[1]).toBe("import_status");
    const [{ n }] = await sql`select count(*)::int n from public.team_time_sync_runs where attempt_id=${out.attemptId}`; expect(n).toBe(1);
    expect((await days())[1].horas_trabalhadas).toBe("06:00");
  });
  it("total que não bate é bloqueado no servidor e nada muda", async () => {
    const p = payloadFrom(tokens("08:00", "16:00")); (p.funcionarios[0] as { totais: { trabalhadas: string } }).totais.trabalhadas = "15:00";
    const out = await runImport(p, deps(SUPER));
    expect(out.kind).toBe("blocked"); expect((await days())[1].horas_trabalhadas).toBe("06:00");
  });
});

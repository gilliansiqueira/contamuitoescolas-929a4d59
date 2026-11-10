// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { handle, importReport, importStatus, type AdminPort } from "./edge-patch";
import { validateReport, contentHash } from "./validate";
const A = "11111111-1111-4111-8111-111111111111";
const body = { attempt_id: A, arquivo: "s.pdf", periodoInicio: "2030-01-01", periodoFim: "2030-01-01",
  funcionarios: [{ codigo: "1", nome: "Pessoa Teste", dias: [{ dia: "2030-01-01", jornada: "08-17", marcacoes: ["08:00", "17:00"], trabalhadas: "09:00", situacao: "regular" }], totais: { trabalhadas: "09:00", extras: "00:00", faltas: "00:00" } }] };
const hash = async () => { const v = validateReport(body); if (!v.ok) throw 0; return contentHash(v.plan); };
const port = (o: Partial<AdminPort> = {}): AdminPort => ({
  rpcImport: vi.fn(async () => ({ data: { status: "success", replay: false, counts: { dias: 1 } }, error: null })),
  findAttempt: vi.fn(async () => ({ data: null, error: null })),
  logRun: vi.fn(async () => ({ error: null })), ...o });
const SECRET = "dado-sensivel-xyz";

describe("importReport (invólucro do servidor)", () => {
  it("sucesso direto", async () => { const r = await importReport(body, port(), "u"); expect(r.status).toBe(200); expect(r.body.status).toBe("success"); });
  it("commit seguido de timeout (exceção) => confirma pela tentativa e retorna sucesso", async () => {
    const h = await hash(); const p = port({ rpcImport: vi.fn(async () => { throw new Error("timeout " + SECRET); }), findAttempt: vi.fn(async () => ({ data: { content_hash: h, counts: { dias: 1 } }, error: null })) });
    const r = await importReport(body, p, "u"); expect(r.status).toBe(200); expect(r.body).toMatchObject({ status: "success", confirmed_after_error: true }); expect(p.logRun).not.toHaveBeenCalled();
  });
  it("erro de transporte sem SQLSTATE => confirma", async () => {
    const h = await hash(); const p = port({ rpcImport: vi.fn(async () => ({ data: null, error: { message: "FetchError" } })), findAttempt: vi.fn(async () => ({ data: { content_hash: h, counts: {} }, error: null })) });
    expect((await importReport(body, p, "u")).body.status).toBe("success");
  });
  it("consulta indisponível => incerto (nunca afirma rollback)", async () => {
    const p = port({ rpcImport: vi.fn(async () => { throw new Error("x"); }), findAttempt: vi.fn(async () => { throw new Error("down"); }) });
    const r = await importReport(body, p, "u"); expect(r.status).toBe(202); expect(r.body).toMatchObject({ status: "uncertain", reason: "consulta_indisponivel" }); expect(r.body.rolled_back).toBeUndefined();
  });
  it("consulta com erro => incerto", async () => {
    const p = port({ rpcImport: vi.fn(async () => { throw new Error("x"); }), findAttempt: vi.fn(async () => ({ data: null, error: { message: "503" } })) });
    expect((await importReport(body, p, "u")).body.status).toBe("uncertain");
  });
  it("tentativa ainda não encontrada => incerto", async () => {
    const p = port({ rpcImport: vi.fn(async () => { throw new Error("x"); }) });
    const r = await importReport(body, p, "u"); expect(r.body).toMatchObject({ status: "uncertain", reason: "tentativa_nao_encontrada" });
  });
  it("tentativa gravada com outro conteúdo => conflito", async () => {
    const p = port({ rpcImport: vi.fn(async () => { throw new Error("x"); }), findAttempt: vi.fn(async () => ({ data: { content_hash: "f".repeat(64), counts: {} }, error: null })) });
    expect((await importReport(body, p, "u")).status).toBe(409);
  });
  it("erro determinístico do banco => desfeito, log só com código, sem mensagem bruta", async () => {
    const p = port({ rpcImport: vi.fn(async () => ({ data: null, error: { code: "P0001", message: "dia fora " + SECRET } })) });
    const r = await importReport(body, p, "u");
    expect(r.status).toBe(422); expect(r.body).toMatchObject({ rolled_back: true, sqlstate: "P0001", log_failed: false });
    expect(JSON.stringify(r.body)).not.toContain(SECRET);
    const logged = (p.logRun as any).mock.calls[0][0]; expect(logged.message).toBe("rpc_error:P0001"); expect(JSON.stringify(logged)).not.toContain(SECRET);
  });
  it("falha do log (erro ou exceção) é informada", async () => {
    const e = { data: null, error: { code: "23505", message: SECRET } };
    expect((await importReport(body, port({ rpcImport: vi.fn(async () => e), logRun: vi.fn(async () => ({ error: { message: "x" } })) }), "u")).body.log_failed).toBe(true);
    expect((await importReport(body, port({ rpcImport: vi.fn(async () => e), logRun: vi.fn(async () => { throw new Error("x"); }) }), "u")).body.log_failed).toBe(true);
  });
  it("validação falha => 400 sem tocar o banco", async () => {
    const p = port(); const r = await importReport({ ...body, periodoFim: "2030-02-30" }, p, "u");
    expect(r.status).toBe(400); expect(p.rpcImport).not.toHaveBeenCalled();
  });
  it("import_status: encontrado, não encontrado, indisponível", async () => {
    expect((await importStatus({ attempt_id: A }, port({ findAttempt: vi.fn(async () => ({ data: { content_hash: "a", counts: {} }, error: null })) }))).body.status).toBe("success");
    expect((await importStatus({ attempt_id: A }, port())).body.status).toBe("not_found");
    expect((await importStatus({ attempt_id: A }, port({ findAttempt: vi.fn(async () => { throw 1; }) }))).status).toBe(503);
  });
});

describe("handle (sessão/permissão)", () => {
  it("sem sessão => 401 e não toca o banco", async () => { const p = port(); const r = await handle({ action: "import_report", ...body }, { userId: async () => null, isSuperAdmin: async () => true }, p); expect(r.status).toBe(401); expect(p.rpcImport).not.toHaveBeenCalled(); });
  it("não super_admin => 403 e não toca o banco", async () => { const p = port(); const r = await handle({ action: "import_report", ...body }, { userId: async () => "u", isSuperAdmin: async () => false }, p); expect(r.status).toBe(403); expect(p.rpcImport).not.toHaveBeenCalled(); expect(p.findAttempt).not.toHaveBeenCalled(); });
  it("falha ao checar sessão => 401", async () => { expect((await handle({}, { userId: async () => { throw 1; }, isSuperAdmin: async () => true }, port())).status).toBe(401); });
  it("super_admin => importa", async () => { expect((await handle({ action: "import_report", ...body }, { userId: async () => "u", isSuperAdmin: async () => true }, port())).status).toBe(200); });
});

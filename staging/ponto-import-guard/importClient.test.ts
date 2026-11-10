// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { runImport, expectedHash, type ClientDeps } from "./importClient";
const P = (nome: string) => ({ arquivo: "s.pdf", periodoInicio: "2030-01-01", periodoFim: "2030-01-01", funcionarios: [{ codigo: "1", nome, dias: [{ dia: "2030-01-01", jornada: "08-17", marcacoes: ["08:00", "17:00"], trabalhadas: "09:00", situacao: "regular" }], totais: { trabalhadas: "09:00", extras: "00:00", faltas: "00:00" } }] });
const ID = "22222222-2222-4222-8222-222222222222";
const deps = (seq: Array<(b: any) => any>): ClientDeps & { calls: any[] } => {
  const calls: any[] = []; let i = 0;
  return { calls, newId: () => ID, sleep: async () => {}, invoke: vi.fn(async (b) => { calls.push(b); const f = seq[Math.min(i++, seq.length - 1)]; return f(b); }) };
};
const ok = { status: 200, body: { status: "success", counts: { dias: 1 } } };
describe("runImport (cliente, dependências injetadas)", () => {
  it("sucesso direto", async () => { const d = deps([() => ok]); expect((await runImport({}, d)).kind).toBe("success"); });
  it("timeout => consulta status com o MESMO attempt_id e confirma pelo hash", async () => {
    const h = await expectedHash(P("Pessoa A"), ID);
    const d = deps([() => { throw new Error("timeout"); }, () => ({ status: 200, body: { status: "not_found" } }), () => ({ status: 200, body: { status: "success", content_hash: h, counts: {} } })]);
    const r = await runImport(P("Pessoa A"), d); expect(r).toMatchObject({ kind: "success", replay: true, attemptId: ID });
    expect(d.calls.map(c => c.action)).toEqual(["import_report", "import_status", "import_status"]);
    expect(new Set(d.calls.map(c => c.attempt_id))).toEqual(new Set([ID]));
  });
  it("incerto e status nunca encontrado => reenvia com o mesmo attempt_id, depois incerto", async () => {
    const d = deps([() => ({ status: 202, body: { status: "uncertain" } }), () => ({ status: 200, body: { status: "not_found" } })]);
    const r = await runImport({}, d, { polls: 2, resends: 1 }); expect(r.kind).toBe("uncertain");
    expect(d.calls.filter(c => c.action === "import_report").length).toBe(2); expect(new Set(d.calls.map(c => c.attempt_id)).size).toBe(1);
  });
  it("reenvio na mesma tentativa devolve replay", async () => {
    const d = deps([() => { throw 1; }, () => { throw 1; }, () => ({ status: 200, body: { status: "success", replay: true, counts: {} } })]);
    expect(await runImport({}, d, { polls: 1 })).toMatchObject({ kind: "success", replay: true });
  });
  it("400 => bloqueado sem consultar status", async () => { const d = deps([() => ({ status: 400, body: { errors: ["e"] } })]); expect(await runImport({}, d)).toMatchObject({ kind: "blocked", errors: ["e"] }); expect(d.calls.length).toBe(1); });
  it("422/403 => recusado sem repetir", async () => {
    for (const s of [422, 403]) { const d = deps([() => ({ status: s, body: { message: "m" } })]); expect((await runImport({}, d)).kind).toBe("rejected"); expect(d.calls.length).toBe(1); }
  });
  it("attempt_id informado é reaproveitado", async () => { const d = deps([() => ok]); await runImport({}, d, { attemptId: "fixo" }); expect(d.calls[0].attempt_id).toBe("fixo"); });
  it("attempt_id já usado por A; B com mesmo id sofre timeout; status traz hash de A => nunca sucesso de B", async () => {
    const hA = await expectedHash(P("Pessoa A"), ID), hB = await expectedHash(P("Pessoa B"), ID);
    expect(hA).toMatch(/^[0-9a-f]{64}$/); expect(hA).not.toBe(hB);
    const d = deps([(b) => { if (b.action === "import_report") throw new Error("timeout"); return { status: 200, body: { status: "success", content_hash: hA, counts: { dias: 1 } } }; }]);
    const r = await runImport(P("Pessoa B"), d, { attemptId: ID, polls: 2 });
    expect(r.kind).toBe("conflict");
  });
  it("status com sucesso mas sem content_hash => não conclui sucesso", async () => {
    const d = deps([(b) => b.action === "import_report" ? { status: 202, body: { status: "uncertain" } } : { status: 200, body: { status: "success", counts: {} } }]);
    expect((await runImport(P("Pessoa A"), d)).kind).toBe("conflict");
  });
});

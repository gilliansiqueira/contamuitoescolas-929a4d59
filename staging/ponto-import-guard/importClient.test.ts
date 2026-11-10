// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { runImport, type ClientDeps } from "./importClient";
const deps = (seq: Array<(b: any) => any>): ClientDeps & { calls: any[] } => {
  const calls: any[] = []; let i = 0;
  return { calls, newId: () => "id-1", sleep: async () => {}, invoke: vi.fn(async (b) => { calls.push(b); const f = seq[Math.min(i++, seq.length - 1)]; return f(b); }) };
};
const ok = { status: 200, body: { status: "success", counts: { dias: 1 } } };
describe("runImport (cliente, dependências injetadas)", () => {
  it("sucesso direto", async () => { const d = deps([() => ok]); expect((await runImport({}, d)).kind).toBe("success"); });
  it("timeout => consulta status com o MESMO attempt_id e confirma", async () => {
    const d = deps([() => { throw new Error("timeout"); }, () => ({ status: 200, body: { status: "not_found" } }), () => ({ status: 200, body: { status: "success", counts: {} } })]);
    const r = await runImport({ x: 1 }, d); expect(r).toMatchObject({ kind: "success", replay: true, attemptId: "id-1" });
    expect(d.calls.map(c => c.action)).toEqual(["import_report", "import_status", "import_status"]);
    expect(new Set(d.calls.map(c => c.attempt_id))).toEqual(new Set(["id-1"]));
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
});

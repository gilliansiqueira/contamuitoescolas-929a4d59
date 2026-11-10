// @vitest-environment node
import { describe, it, expect } from "vitest";
import { validateReport, contentHash } from "./validate";
const dia = (d: string, o: Record<string, unknown> = {}) => ({ dia: d, jornada: "08:00-17:00", marcacoes: ["08:00", "12:00", "13:00", "17:00"], trabalhadas: "08:00", extras: null, faltas: null, situacao: "regular", ...o });
const base = (o: Record<string, unknown> = {}, f: Record<string, unknown> = {}) => ({ attempt_id: "11111111-1111-4111-8111-111111111111", arquivo: "sintetico.pdf", periodoInicio: "2030-01-01", periodoFim: "2030-01-03",
  funcionarios: [{ codigo: "1", nome: "Pessoa Teste", matricula: "10", funcao: "Aux", departamento: "Adm", dias: [dia("2030-01-01"), dia("2030-01-02")], totais: { trabalhadas: "16:00", extras: "00:00", faltas: "00:00" }, ...f }], ...o });
const errs = (b: unknown) => { const r = validateReport(b as any); return r.ok ? [] : r.errors.join(" | "); };

describe("validateReport", () => {
  it("aceita relatório sintético válido", () => { const r = validateReport(base()); expect(r.ok && r.plan.counts).toEqual({ funcionarios: 1, dias: 2, ocorrencias: 0 }); });
  it("rejeita data impossível", () => expect(errs(base({ periodoFim: "2030-02-30" }))).toMatch(/data inválida/));
  it("rejeita início após fim", () => expect(errs(base({ periodoInicio: "2030-01-05" }))).toMatch(/depois do fim/));
  it("rejeita período longo", () => expect(errs(base({ periodoFim: "2030-04-01" }))).toMatch(/acima de 62/));
  it("rejeita dia inválido em vez de ignorar", () => expect(errs(base({}, { dias: [dia("2030-01-32")] }))).toMatch(/data inválida/));
  it("rejeita dia fora do período", () => expect(errs(base({}, { dias: [dia("2030-01-09")] }))).toMatch(/fora do período/));
  it("rejeita dia repetido", () => expect(errs(base({}, { dias: [dia("2030-01-01"), dia("2030-01-01")] }))).toMatch(/repetido/));
  it("rejeita marcação malformada sem filtrar", () => expect(errs(base({}, { dias: [dia("2030-01-01", { marcacoes: ["08:00", "25:61"] })] }))).toMatch(/marcação inválida/));
  it("rejeita excesso de marcações sem truncar", () => expect(errs(base({}, { dias: [dia("2030-01-01", { marcacoes: Array.from({ length: 13 }, (_, i) => `${String(i + 6).padStart(2, "0")}:00`) })] }))).toMatch(/máximo 12/));
  it("preserva ordem de jornada noturna sem reordenar", () => { const r = validateReport(base({}, { dias: [dia("2030-01-01", { marcacoes: ["22:00", "02:00", "03:00", "06:00"], trabalhadas: "16:00" })] })); expect(r.ok && r.plan.daily[0].marcacoes).toEqual(["22:00", "02:00", "03:00", "06:00"]); });
  it("bloqueia total divergente", () => expect(errs(base({}, { totais: { trabalhadas: "15:00", extras: "00:00", faltas: "00:00" } }))).toMatch(/difere/));
  it("bloqueia total ausente", () => expect(errs(base({}, { totais: undefined }))).toMatch(/ausente/));
  it("rejeita campo de documento", () => expect(errs(base({}, { cpf: "x" }))).toMatch(/proibido/));
  it("aceita código numérico longo (não confunde com documento)", () => expect(validateReport(base({}, { codigo: "90000000001" })).ok).toBe(true));
  it("rejeita campo fora do esquema", () => expect(errs(base({}, { extra: "x" }))).toMatch(/não permitido/));
  it("rejeita campo proibido dentro do dia", () => expect(errs(base({}, { dias: [dia("2030-01-01", { pis: "x" }), dia("2030-01-02")] }))).toMatch(/proibido/));
  it("exige attempt_id", () => expect(errs(base({ attempt_id: undefined }))).toMatch(/attempt_id/));
  it("rejeita código repetido", () => { const b = base(); (b.funcionarios as any[]).push({ ...(b.funcionarios as any[])[0] }); expect(errs(b)).toMatch(/repetido/); });
  it("rejeita texto longo em vez de truncar", () => expect(errs(base({}, { nome: "x".repeat(121) }))).toMatch(/acima de 120/));
  it("folga sem registro não vira linha", () => { const r = validateReport(base({}, { dias: [dia("2030-01-01"), dia("2030-01-02"), { dia: "2030-01-03", marcacoes: [] }] })); expect(r.ok && r.plan.daily.length).toBe(2); });
  it("mesma entrada gera mesma chave; outra entrada muda a chave", async () => {
    const a = validateReport(base()), b = validateReport(base()), c = validateReport(base({}, { nome: "Outra Pessoa" }));
    if (!a.ok || !b.ok || !c.ok) throw new Error("inválido");
    expect(await contentHash(a.plan)).toBe(await contentHash(b.plan));
    expect(await contentHash(a.plan)).not.toBe(await contentHash(c.plan));
  });
});

// Cliente da importação (PROMOÇÃO FUTURA para src/hooks/useTeamTime.ts — não aplicado).
// Mantém o MESMO attempt_id em toda a tentativa: após timeout/incerteza consulta import_status e,
// se ainda não encontrado, reenvia com o mesmo attempt_id (o servidor reaplica ou devolve o já gravado).
export interface InvokeResult { status: number; body: Record<string, unknown> }
export interface ClientDeps {
  invoke(body: Record<string, unknown>): Promise<InvokeResult>; // lança em erro de rede/timeout
  newId(): string;
  sleep(ms: number): Promise<void>;
}
export type ImportOutcome =
  | { kind: "success"; attemptId: string; counts: unknown; replay: boolean }
  | { kind: "blocked"; attemptId: string; errors: string[] }
  | { kind: "rejected"; attemptId: string; message: string }
  | { kind: "uncertain"; attemptId: string };

export async function runImport(payload: Record<string, unknown>, deps: ClientDeps, opts: { attemptId?: string; polls?: number; resends?: number; delayMs?: number } = {}): Promise<ImportOutcome> {
  const attemptId = opts.attemptId ?? deps.newId();
  const polls = opts.polls ?? 3, resends = opts.resends ?? 1, delay = opts.delayMs ?? 1500;
  const send = async (): Promise<InvokeResult | null> => { try { return await deps.invoke({ action: "import_report", ...payload, attempt_id: attemptId }); } catch { return null; } };
  const status = async (): Promise<InvokeResult | null> => { try { return await deps.invoke({ action: "import_status", attempt_id: attemptId }); } catch { return null; } };

  for (let round = 0; round <= resends; round++) {
    const r = await send();
    if (r?.body.status === "success") return { kind: "success", attemptId, counts: r.body.counts, replay: !!r.body.replay };
    if (r && r.status === 400) return { kind: "blocked", attemptId, errors: (r.body.errors as string[]) ?? [] };
    if (r && (r.status === 422 || r.status === 409 || r.status === 401 || r.status === 403)) return { kind: "rejected", attemptId, message: String(r.body.message ?? r.body.error ?? "Recusado") };
    // Incerto (202), 5xx ou exceção: consulta pela MESMA tentativa.
    for (let i = 0; i < polls; i++) {
      await deps.sleep(delay);
      const s = await status();
      if (s?.body.status === "success") return { kind: "success", attemptId, counts: s.body.counts, replay: true };
    }
  }
  return { kind: "uncertain", attemptId };
}

/* Ligação real (na promoção), no hook:
const deps: ClientDeps = {
  invoke: async (body) => { const { data, error } = await supabase.functions.invoke('pontofopag-sync', { body });
    if (!error) return { status: 200, body: data };
    const ctx = (error as any).context; if (!ctx?.status) throw error; return { status: ctx.status, body: await ctx.json().catch(() => ({})) }; },
  newId: () => crypto.randomUUID(), sleep: (ms) => new Promise(r => setTimeout(r, ms)),
};
*/

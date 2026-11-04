import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Person } from '@/components/team/ClientService';

const db = supabase as any;
const dayKey = (ts: string) => new Date(ts).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

/** Acompanhamento: quem abre o sininho, o Meu Dia, clica e marca avisos, e lê os guias (últimos 7 dias). */
export function TeamActivityTab({ people }: { people: Person[] }) {
  const since = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString(); }, []);
  const { data, isLoading } = useQuery({
    queryKey: ['team-activity', since],
    queryFn: async () => {
      const [ev, prog, arts] = await Promise.all([
        db.from('team_activity_events').select('user_id,kind,created_at').gte('created_at', since).limit(10000),
        db.from('help_progress').select('user_id,article_id'),
        db.from('help_articles').select('id').eq('trilha', true),
      ]);
      return { ev: (ev.data ?? []) as { user_id: string; kind: string; created_at: string }[], prog: (prog.data ?? []) as { user_id: string }[], totalTrilha: (arts.data ?? []).length };
    },
  });
  const rows = useMemo(() => {
    const by = new Map<string, { dias: Set<string>; sino: number; meudia: Set<string>; clic: number; visto: number; popup: number; guias: number; ultimo: string }>();
    for (const e of data?.ev ?? []) {
      const r = by.get(e.user_id) ?? { dias: new Set(), sino: 0, meudia: new Set(), clic: 0, visto: 0, popup: 0, guias: 0, ultimo: '' };
      r.dias.add(dayKey(e.created_at));
      if (e.kind === 'sino_aberto') r.sino++;
      if (e.kind === 'meudia_aberto') r.meudia.add(dayKey(e.created_at));
      if (e.kind === 'aviso_clicado') r.clic++;
      if (e.kind === 'aviso_visto') r.visto++;
      if (e.kind === 'popup_entendi') r.popup++;
      if (e.created_at > r.ultimo) r.ultimo = e.created_at;
      by.set(e.user_id, r);
    }
    const prog = new Map<string, number>();
    for (const p of data?.prog ?? []) prog.set(p.user_id, (prog.get(p.user_id) ?? 0) + 1);
    return people.map(p => ({ p, r: by.get(p.id), guias: prog.get(p.id) ?? 0 }))
      .sort((a, b) => (b.r?.dias.size ?? 0) - (a.r?.dias.size ?? 0) || a.p.name.localeCompare(b.p.name));
  }, [data, people]);

  return (
    <section className="rounded-lg border border-border bg-card p-3.5 space-y-2">
      <h2 className="text-sm font-medium">Acompanhamento da equipe — últimos 7 dias</h2>
      <p className="text-[11px] text-muted-foreground">Conta a partir da publicação desta tela. "Avisos vistos" = clicou no ✓; "Abriu empresa" = clicou num aviso para abrir a empresa.</p>
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-muted-foreground border-b">
              <th className="py-1.5 pr-2">Pessoa</th><th className="px-2">Dias ativos</th><th className="px-2">Abriu o Meu Dia (dias)</th><th className="px-2">Abriu o sininho</th>
              <th className="px-2">Abriu empresa pelo aviso</th><th className="px-2">Avisos vistos</th><th className="px-2">"Entendi" na janela</th><th className="px-2">Guias concluídos</th><th className="px-2">Último uso</th>
            </tr></thead>
            <tbody>
              {rows.map(({ p, r, guias }) => (
                <tr key={p.id} className={`border-b last:border-0 ${!r ? 'text-muted-foreground' : ''}`}>
                  <td className="py-1.5 pr-2 font-medium">{p.name}</td>
                  <td className="px-2">{r?.dias.size ?? 0}/7</td>
                  <td className={`px-2 ${r && r.meudia.size === 0 ? 'text-destructive' : ''}`}>{r?.meudia.size ?? 0}</td>
                  <td className="px-2">{r?.sino ?? 0}</td>
                  <td className="px-2">{r?.clic ?? 0}</td>
                  <td className="px-2">{r?.visto ?? 0}</td>
                  <td className="px-2">{r?.popup ?? 0}</td>
                  <td className="px-2">{guias}/{data?.totalTrilha ?? 0}</td>
                  <td className="px-2">{r?.ultimo ? new Date(r.ultimo).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'sem registro'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

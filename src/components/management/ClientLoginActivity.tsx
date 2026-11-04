import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { accessTone, daysSince, lastAccess, type AccessTone } from '@/lib/clientAccessActivity';

interface Row { user_id: string; email: string; school_id: string | null; school_name: string | null; last_sign_in_at: string | null; last_seen_at: string | null; days_30: number }
type Filter = 'all' | 'never' | 'stale';

const toneCls: Record<AccessTone, string> = {
  recent: 'bg-primary/15 text-primary',
  warn: 'bg-warning/20 text-warning-foreground',
  stale: 'bg-destructive/15 text-destructive',
  never: 'bg-destructive text-destructive-foreground',
};
const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Nunca acessou';
const ago = (d: number | null) => d === null ? '' : d === 0 ? 'hoje' : d === 1 ? 'há 1 dia' : `há ${d} dias`;

export function ClientLoginActivity() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['client-access-overview'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_client_access_overview');
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const groups = useMemo(() => {
    const m = new Map<string, { id: string; nome: string; users: (Row & { last: string | null })[]; last: string | null }>();
    for (const r of data ?? []) {
      const id = r.school_id ?? 'none';
      const g = m.get(id) ?? { id, nome: r.school_name ?? 'Sem empresa vinculada', users: [], last: null };
      const last = lastAccess(r.last_sign_in_at, r.last_seen_at);
      if (!g.users.some(u => u.user_id === r.user_id)) g.users.push({ ...r, last });
      if (last && (!g.last || last > g.last)) g.last = last;
      m.set(id, g);
    }
    return [...m.values()]
      .filter(g => g.nome.toLowerCase().includes(q.trim().toLowerCase()))
      .filter(g => { const d = daysSince(g.last); return filter === 'all' || (filter === 'never' ? d === null : d === null || d > 30); })
      .sort((a, b) => (a.last ?? '').localeCompare(b.last ?? '') || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [data, q, filter]);

  return (
    <div>
      <h1 className="text-2xl font-medium">Acessos dos clientes</h1>
      <p className="mt-1 text-xs text-muted-foreground">Último acesso de cada cliente à plataforma. A abertura diária passa a ser registrada a partir de 04/11/2026; antes vale a data do último login.</p>
      <div className="my-4 flex flex-wrap items-center gap-2">
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar empresa" className="h-9 w-60 text-xs" />
        {([['all', 'Todas'], ['never', 'Nunca acessaram'], ['stale', 'Sem acesso há 30+ dias']] as [Filter, string][]).map(([k, l]) => (
          <Button key={k} size="sm" variant={filter === k ? 'default' : 'outline'} className="h-9 text-xs" onClick={() => setFilter(k)}>{l}</Button>
        ))}
      </div>
      {isLoading && <p className="text-xs text-muted-foreground">Carregando…</p>}
      {error && <p className="text-xs text-destructive">Não foi possível carregar os acessos.</p>}
      <div className="space-y-1.5">
        {groups.map(g => {
          const d = daysSince(g.last);
          return (
            <div key={g.id} className="rounded-md border border-border bg-card">
              <button type="button" onClick={() => setOpen(o => o === g.id ? null : g.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs hover:bg-muted/40">
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open === g.id ? '' : '-rotate-90'}`} />
                <strong className="min-w-0 flex-1 truncate">{g.nome}</strong>
                <span className="text-muted-foreground">{g.users.length} {g.users.length === 1 ? 'login' : 'logins'}</span>
                <span className="w-36 text-right">{fmt(g.last)}</span>
                <span className={`w-28 rounded-full px-2 py-0.5 text-center text-[11px] font-medium ${toneCls[accessTone(d)]}`}>{d === null ? 'Nunca' : ago(d)}</span>
              </button>
              {open === g.id && (
                <div className="space-y-1 border-t border-border p-2">
                  {g.users.map(u => {
                    const ud = daysSince(u.last);
                    return (
                      <div key={u.user_id} className="flex items-center gap-3 rounded px-2 py-1.5 text-xs">
                        <span className="min-w-0 flex-1 truncate">{u.email}</span>
                        <span className="text-muted-foreground">{u.days_30} {u.days_30 === 1 ? 'dia' : 'dias'} com acesso (30 dias)</span>
                        <span className="w-36 text-right">{fmt(u.last)}</span>
                        <span className={`w-28 rounded-full px-2 py-0.5 text-center text-[11px] ${toneCls[accessTone(ud)]}`}>{ud === null ? 'Nunca' : ago(ud)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {!isLoading && !groups.length && <p className="text-xs text-muted-foreground">Nenhuma empresa nesse filtro.</p>}
      </div>
    </div>
  );
}

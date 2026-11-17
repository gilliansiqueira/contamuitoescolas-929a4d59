import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { filterClientPending, pendingMonths, type ClientPendingRow } from '@/lib/clientPending';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => d.split('-').reverse().join('/');
const fmtMonth = (m: string) => { const [y, mm] = m.split('-'); return `${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][+mm - 1]}/${y}`; };

function Row({ r, onSaved }: { r: ClientPendingRow; onSaved: () => void }) {
  const [cat, setCat] = useState(r.categoria_texto ?? '');
  const [obs, setObs] = useState(r.observacao ?? '');
  const [saving, setSaving] = useState(false);
  const dirty = cat !== (r.categoria_texto ?? '') || obs !== (r.observacao ?? '');
  const save = async () => {
    if (!cat.trim()) { toast.error('Escreva qual é essa despesa'); return; }
    setSaving(true);
    const { error } = await (supabase as any).rpc('save_client_tx_note', { _tx_id: r.id, _texto: cat, _obs: obs });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Enviado para a equipe');
    onSaved();
  };
  return (
    <tr className="border-t align-top">
      <td className="p-2 whitespace-nowrap">{fmtDate(r.data)}</td>
      <td className="p-2"><div>{r.descricao}</div><div className="text-xs text-muted-foreground">{r.conta}</div></td>
      <td className="p-2 text-right tabular-nums text-destructive whitespace-nowrap">{fmtBRL(Number(r.valor))}</td>
      <td className="p-2 min-w-56"><Input value={cat} onChange={e => setCat(e.target.value)} placeholder="Ex.: material de limpeza" maxLength={300} /></td>
      <td className="p-2 min-w-48"><Input value={obs} onChange={e => setObs(e.target.value)} placeholder="Opcional" maxLength={1000} /></td>
      <td className="p-2 whitespace-nowrap">
        <Button size="sm" onClick={save} disabled={saving || !dirty}>{r.note_updated_at ? 'Atualizar' : 'Enviar'}</Button>
        {r.note_updated_at && <div className="mt-1 text-[11px] text-muted-foreground">Enviado em {new Date(r.note_updated_at).toLocaleDateString('pt-BR')}</div>}
      </td>
    </tr>
  );
}

export function ClientPendencias({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const [month, setMonth] = useState('all');
  const [search, setSearch] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['clientPendingOutflows', schoolId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('client_pending_outflows', { _school_id: schoolId });
      if (error) throw error;
      return (data ?? []) as ClientPendingRow[];
    },
  });
  const months = useMemo(() => pendingMonths(rows), [rows]);
  const list = useMemo(() => filterClientPending(rows, month, search, onlyOpen), [rows, month, search, onlyOpen]);
  const total = list.reduce((s, r) => s + Number(r.valor), 0);
  const answered = rows.filter(r => (r.categoria_texto ?? '').trim()).length;
  const refresh = () => qc.invalidateQueries({ queryKey: ['clientPendingOutflows', schoolId] });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pendências de saídas</CardTitle>
        <p className="text-sm text-muted-foreground">Pagamentos que saíram do banco e ainda não identificamos. Escreva o que é cada um para a equipe lançar. Quando a equipe conciliar, a linha some daqui.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos os meses</SelectItem>{months.map(m => <SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="w-64" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar" />
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground"><Checkbox checked={onlyOpen} onCheckedChange={v => setOnlyOpen(!!v)} />Só sem resposta</label>
          <span className="ml-auto text-sm text-muted-foreground">{list.length} saídas · {fmtBRL(total)} · {answered} de {rows.length} respondidas</span>
        </div>
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p>
          : error ? <p className="text-sm text-destructive">Não foi possível carregar as pendências.</p>
          : list.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma saída pendente.</p>
          : <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-2">Data</th><th className="p-2">Descrição no banco</th><th className="p-2 text-right">Valor</th><th className="p-2">Qual é essa despesa?</th><th className="p-2">Observação</th><th className="p-2" /></tr></thead>
              <tbody>{list.map(r => <Row key={`${r.id}-${r.note_updated_at ?? ''}`} r={r} onSaved={refresh} />)}</tbody>
            </table></div>}
      </CardContent>
    </Card>
  );
}

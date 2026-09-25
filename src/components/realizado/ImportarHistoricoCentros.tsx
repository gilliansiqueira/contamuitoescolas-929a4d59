import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { History, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAll';
import type { DetailGroup, DetailItem } from '@/hooks/useExpenseDetail';
import { parseSpreadsheet } from './DetalhamentoDespesas';

const TIPO_UPLOAD = 'centro_custos';

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function norm(s: string) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}
function num(s: string) {
  return parseFloat((s || '0').replace(/\./g, '').replace(',', '.')) || 0;
}

type Modo = 'pular' | 'substituir';

interface Props {
  schoolId: string;
  groups: DetailGroup[];
  items: DetailItem[];
}

export function ImportarHistoricoCentros({ schoolId, groups, items }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState('');
  const [arquivo, setArquivo] = useState('');
  const [modo, setModo] = useState<Modo>('pular');
  const [saving, setSaving] = useState(false);

  const uploads = useQuery({
    queryKey: ['cc-uploads', schoolId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('upload_records')
        .select('*')
        .eq('school_id', schoolId)
        .eq('tipo', TIPO_UPLOAD)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const groupName = useMemo(() => new Map(groups.map(g => [g.id, g.name])), [groups]);

  const conf = useMemo(() => {
    if (!texto.trim()) return null;
    const { rows, warnings } = parseSpreadsheet(texto, '');
    const parsed = rows.map(r => ({ ...r, v: num(r.valor) }));
    const key = (c: string, d: string, desc: string, t: string, v: number) =>
      `${norm(c)}|${d}|${norm(desc)}|${t}|${v.toFixed(2)}`;
    const existing = new Map<string, number>();
    items.forEach(i => {
      const k = key(groupName.get(i.group_id) || '', i.data, i.descricao, i.tipo, Number(i.valor));
      existing.set(k, (existing.get(k) || 0) + 1);
    });
    const seen = new Map<string, number>();
    const dups: typeof parsed = [];
    const internalDups: typeof parsed = [];
    parsed.forEach(r => {
      const k = key(r.grupo, r.data, r.descricao, r.tipo, r.v);
      const n = (seen.get(k) || 0) + 1;
      seen.set(k, n);
      if (n <= (existing.get(k) || 0)) dups.push(r);
      else if (n > 1) internalDups.push(r);
    });
    const receitas = parsed.filter(r => r.tipo === 'receita').reduce((s, r) => s + r.v, 0);
    const despesas = parsed.filter(r => r.tipo === 'despesa').reduce((s, r) => s + r.v, 0);
    const porCentro = new Map<string, { r: number; d: number; n: number }>();
    const porMes = new Map<string, { r: number; d: number; n: number }>();
    parsed.forEach(r => {
      for (const [m, k] of [[porCentro, r.grupo.trim()], [porMes, r.data.slice(0, 7)]] as const) {
        const e = m.get(k) || { r: 0, d: 0, n: 0 };
        if (r.tipo === 'receita') e.r += r.v; else e.d += r.v;
        e.n++;
        m.set(k, e);
      }
    });
    const meses = [...porMes.keys()].sort();
    return { parsed, warnings, dups, internalDups, receitas, despesas, porCentro, porMes, meses };
  }, [texto, items, groupName]);

  const existentesNoPeriodo = useMemo(() => {
    if (!conf?.meses.length) return [];
    const set = new Set(conf.meses);
    return items.filter(i => set.has(i.data.slice(0, 7)));
  }, [conf, items]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['expense-detail-items', schoolId] });
    qc.invalidateQueries({ queryKey: ['expense-detail-groups', schoolId] });
    qc.invalidateQueries({ queryKey: ['cc-uploads', schoolId] });
    qc.invalidateQueries();
  };

  const importar = async () => {
    if (!conf || !conf.parsed.length) return;
    const nome = arquivo.trim();
    if (!nome) { toast.error('Informe o nome do arquivo/origem'); return; }
    setSaving(true);
    try {
      const rows = modo === 'pular'
        ? conf.parsed.filter(r => !conf.dups.includes(r))
        : conf.parsed;
      if (modo === 'substituir' && existentesNoPeriodo.length) {
        const ids = existentesNoPeriodo.map(i => i.id);
        for (let i = 0; i < ids.length; i += 200) {
          const { error } = await supabase.from('expense_detail_items').delete().in('id', ids.slice(i, i + 200));
          if (error) throw error;
        }
      }
      const { data: up, error: upErr } = await supabase
        .from('upload_records')
        .insert({ school_id: schoolId, file_name: nome, tipo: TIPO_UPLOAD, record_count: rows.length })
        .select()
        .single();
      if (upErr) throw upErr;

      const cache = [...groups];
      let sort = cache.length;
      const ensure = async (name: string) => {
        const f = cache.find(g => norm(g.name) === norm(name));
        if (f) return f.id;
        const { data, error } = await supabase
          .from('expense_detail_groups')
          .insert({ school_id: schoolId, name: name.trim(), sort_order: sort++ })
          .select()
          .single();
        if (error) throw error;
        cache.push(data as DetailGroup);
        return (data as DetailGroup).id;
      };
      const now = new Date().toISOString();
      const inserts: any[] = [];
      for (const r of rows) {
        inserts.push({
          school_id: schoolId,
          group_id: await ensure(r.grupo),
          descricao: r.descricao,
          valor: r.v,
          data: r.data,
          tipo: r.tipo,
          origem_upload_id: up.id,
          source_file: nome,
          imported_at: now,
        });
      }
      for (let i = 0; i < inserts.length; i += 500) {
        const { error } = await supabase.from('expense_detail_items').insert(inserts.slice(i, i + 500));
        if (error) throw error;
      }
      toast.success(`${inserts.length} lançamento(s) importados`);
      setTexto('');
      setArquivo('');
      invalidate();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao importar');
    } finally {
      setSaving(false);
    }
  };

  const desfazer = async (id: string, nome: string) => {
    if (!confirm(`Desfazer a importação "${nome}"? Todos os lançamentos dela serão removidos.`)) return;
    const { error } = await supabase.from('upload_records').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    const restantes = await fetchAllRows<any>('expense_detail_items', q => q.eq('origem_upload_id', id), 1000, 'id');
    if (restantes.length) toast.error(`${restantes.length} lançamento(s) não foram removidos`);
    else toast.success('Importação desfeita');
    invalidate();
  };

  return (
    <>
      <Button size="sm" variant="outline" className="rounded-xl gap-2" onClick={() => setOpen(true)}>
        <History className="w-4 h-4" /> Importar histórico
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar histórico de centros de custo</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Cole do Excel as colunas: <strong>centro de custo, data, descrição, tipo (receita/despesa), valor</strong>.
            Nada é gravado antes da conferência. Estes lançamentos são apenas análise e não alteram Receita, Despesa, Resultado ou Caixa.
          </p>
          <Input placeholder="Nome do arquivo / origem (ex.: Ather - Quintal de Casa - set/2026)" value={arquivo} onChange={e => setArquivo(e.target.value)} />
          <Textarea rows={6} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Cole aqui..." className="font-mono text-xs" />

          {conf && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-lg border p-2"><div className="text-xs text-muted-foreground">Linhas lidas</div><strong>{conf.parsed.length}</strong></div>
                <div className="rounded-lg border p-2"><div className="text-xs text-muted-foreground">Receitas</div><strong>{brl(conf.receitas)}</strong></div>
                <div className="rounded-lg border p-2"><div className="text-xs text-muted-foreground">Despesas</div><strong>{brl(conf.despesas)}</strong></div>
                <div className="rounded-lg border p-2"><div className="text-xs text-muted-foreground">Resultado</div><strong>{brl(conf.receitas - conf.despesas)}</strong></div>
              </div>

              {conf.warnings.length > 0 && (
                <details className="rounded-lg border border-destructive/40 p-2" open>
                  <summary className="text-destructive cursor-pointer">{conf.warnings.length} linha(s) ignorada(s)</summary>
                  <ul className="text-xs mt-1 space-y-0.5">{conf.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </details>
              )}

              <div className="grid md:grid-cols-2 gap-3">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-muted-foreground"><th>Centro</th><th>Linhas</th><th className="text-right">Receita</th><th className="text-right">Despesa</th></tr></thead>
                  <tbody>{[...conf.porCentro].map(([k, v]) => (
                    <tr key={k} className="border-t"><td>{k}</td><td>{v.n}</td><td className="text-right">{brl(v.r)}</td><td className="text-right">{brl(v.d)}</td></tr>
                  ))}</tbody>
                </table>
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-muted-foreground"><th>Mês</th><th>Linhas</th><th className="text-right">Receita</th><th className="text-right">Despesa</th></tr></thead>
                  <tbody>{conf.meses.map(m => { const v = conf.porMes.get(m)!; return (
                    <tr key={m} className="border-t"><td>{m.split('-').reverse().join('/')}</td><td>{v.n}</td><td className="text-right">{brl(v.r)}</td><td className="text-right">{brl(v.d)}</td></tr>
                  ); })}</tbody>
                </table>
              </div>

              {(conf.dups.length > 0 || conf.internalDups.length > 0) && (
                <details className="rounded-lg border border-accent p-2">
                  <summary className="cursor-pointer">
                    {conf.dups.length} linha(s) já existem no sistema · {conf.internalDups.length} repetida(s) dentro da própria planilha
                  </summary>
                  <table className="w-full text-xs mt-1"><tbody>
                    {[...conf.dups.map(r => ({ r, t: 'já existe' })), ...conf.internalDups.map(r => ({ r, t: 'repetida na planilha' }))].map(({ r, t }, i) => (
                      <tr key={i} className="border-t"><td>{t}</td><td>{r.grupo}</td><td>{r.data.split('-').reverse().join('/')}</td><td>{r.descricao}</td><td>{r.tipo}</td><td className="text-right">{brl(r.v)}</td></tr>
                    ))}
                  </tbody></table>
                </details>
              )}

              <div className="rounded-lg border p-2 space-y-1">
                <label className="flex items-center gap-2"><input type="radio" checked={modo === 'pular'} onChange={() => setModo('pular')} />
                  Somar ao que já existe, pulando as {conf.dups.length} linha(s) já existentes</label>
                <label className="flex items-center gap-2"><input type="radio" checked={modo === 'substituir'} onChange={() => setModo('substituir')} />
                  Substituir os meses da planilha ({existentesNoPeriodo.length} lançamento(s) atuais nesses meses serão removidos)</label>
              </div>

              <div className="flex justify-end">
                <Button disabled={saving || !conf.parsed.length || conf.warnings.length > 0} onClick={importar}>
                  {saving ? 'Importando...' : 'Aprovar e importar'}
                </Button>
              </div>
              {conf.warnings.length > 0 && <p className="text-xs text-destructive text-right">Corrija as linhas ignoradas antes de importar.</p>}
            </div>
          )}

          <div className="pt-2 border-t">
            <h4 className="text-sm font-semibold mb-1">Importações anteriores</h4>
            {(uploads.data || []).length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma.</p> : (
              <ul className="text-xs space-y-1">{uploads.data!.map((u: any) => (
                <li key={u.id} className="flex items-center justify-between border rounded-lg px-2 py-1">
                  <span>{u.file_name} · {u.record_count} linhas · {new Date(u.uploaded_at).toLocaleString('pt-BR')}</span>
                  <Button size="sm" variant="ghost" onClick={() => desfazer(u.id, u.file_name)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </li>
              ))}</ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Plus, Trash2, Palette } from 'lucide-react';
import { renewalDb as db, type RenewalTemplate } from '@/hooks/useRenewal';
import { defaultColumns, newColId, withMissingFields } from '@/lib/renewal/fields';
import type { ColType, RenewalColumn, TemplateStructure } from '@/lib/renewal/types';

const TYPE_LABEL: Record<ColType, string> = { text: 'Texto', date: 'Data', number: 'Número', list: 'Lista de opções' };
const toHex = (argb?: string) => (argb ? `#${argb.slice(2)}` : '#ffffff');
const toArgb = (hex: string) => `FF${hex.replace('#', '').toUpperCase()}`;

const baseStructure = (cols: RenewalColumn[], headerColor: string, prev?: TemplateStructure): TemplateStructure => ({
  sheets: prev?.sheets ?? ['Renovação'], mainSheet: prev?.mainSheet ?? 'Renovação', columns: cols, headerColor,
  summary: { byProfessor: true, byStatus: true, bySituacao: true, formulas: [] }, separateModalities: true, notes: [],
});

/** Monta o modelo da escola na tela: escolher, ordenar, renomear e colorir colunas. */
export function TemplateBuilder({ schoolId, current, onSave, busy }: {
  schoolId: string; current?: RenewalTemplate; busy: boolean;
  onSave: (s: TemplateStructure, name: string) => Promise<void>;
}) {
  const init = () => (current ? withMissingFields(current.structure.columns) : defaultColumns());
  const [cols, setCols] = useState<RenewalColumn[]>(init);
  const [header, setHeader] = useState(current?.structure.headerColor ?? 'FF002060');
  const [openList, setOpenList] = useState<string | null>(null);
  useEffect(() => { setCols(init()); setHeader(current?.structure.headerColor ?? 'FF002060'); }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: others = [] } = useQuery({ queryKey: ['renewal_templates_others', schoolId], queryFn: async () => {
    const { data, error } = await db.from('renewal_templates').select('id, structure, school_id, schools(nome)').eq('approved', true).neq('school_id', schoolId);
    if (error) throw error; return data as any[];
  } });

  const upd = (id: string, p: Partial<RenewalColumn>) => setCols(cs => cs.map(c => (c.id === id ? { ...c, ...p } : c)));
  const move = (i: number, d: number) => setCols(cs => { const j = i + d; if (j < 0 || j >= cs.length) return cs; const n = [...cs]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const add = () => setCols(cs => [...cs, { id: newColId(), title: 'Nova coluna', kind: 'manual', type: 'text' }]);
  const used = cols.filter(c => !c.hidden).length;

  const copyFrom = (id: string) => {
    const o = others.find(x => x.id === id); if (!o) return;
    setCols(withMissingFields(o.structure.columns.map((c: RenewalColumn) => ({ ...c, id: newColId() }))));
    setHeader(o.structure.headerColor ?? 'FF002060');
    toast.success(`Modelo de ${o.schools?.nome ?? 'outra escola'} copiado. Revise e salve.`);
  };

  const save = async () => {
    if (!cols.some(c => !c.hidden && c.field === 'aluno')) return toast.error('A coluna Aluno precisa estar em uso.');
    const clean = cols.map(c => c.type === 'list' ? { ...c, options: (c.options ?? []).map(o => o.trim()).filter(Boolean) } : c);
    await onSave(baseStructure(clean, header, current?.structure), 'Modelo montado na tela');
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Modelo da escola</h3>
          <p className="text-xs text-muted-foreground">Marque as colunas que vão para a planilha, ajuste nomes e ordem. {used} em uso.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {others.length > 0 && (
            <Select onValueChange={copyFrom}><SelectTrigger className="h-8 w-56 text-xs"><SelectValue placeholder="Copiar modelo de outra escola" /></SelectTrigger>
              <SelectContent>{others.map(o => <SelectItem key={o.id} value={o.id}>{o.schools?.nome ?? o.school_id}</SelectItem>)}</SelectContent></Select>
          )}
          <label className="flex items-center gap-1 text-xs">Cor do título
            <input type="color" value={toHex(header)} onChange={e => setHeader(toArgb(e.target.value))} className="h-7 w-9 cursor-pointer rounded border border-border" /></label>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted-foreground"><th className="w-12 py-1">Usar</th><th className="w-10">#</th><th>Nome na planilha</th><th>Tipo</th><th>Preenchimento</th><th className="w-28" /></tr></thead>
          <tbody>
            {cols.map((c, i) => (
              <>
                <tr key={c.id} className={`border-t border-border ${c.hidden ? 'opacity-50' : ''}`}>
                  <td className="py-1"><Checkbox checked={!c.hidden} onCheckedChange={v => upd(c.id, { hidden: !v })} /></td>
                  <td>{c.hidden ? '—' : cols.slice(0, i + 1).filter(x => !x.hidden).length}</td>
                  <td><Input className="h-7 text-xs" value={c.title} onChange={e => upd(c.id, { title: e.target.value })} /></td>
                  <td>
                    {c.field ? <span>{TYPE_LABEL[c.type]}</span> : (
                      <Select value={c.type} onValueChange={v => upd(c.id, { type: v as ColType })}><SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{(Object.keys(TYPE_LABEL) as ColType[]).map(t => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}</SelectContent></Select>
                    )}
                  </td>
                  <td className="text-muted-foreground">{c.kind === 'imported' ? 'Sponte (turmas)' : c.kind === 'calculated' ? 'Calculada (contas a receber)' : 'Equipe'}</td>
                  <td className="whitespace-nowrap text-right">
                    {c.type === 'list' && <Button size="icon" variant="ghost" className="h-7 w-7" title="Opções e cores" onClick={() => setOpenList(openList === c.id ? null : c.id)}><Palette className="h-4 w-4" /></Button>}
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, 1)} disabled={i === cols.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                    {!c.field && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCols(cs => cs.filter(x => x.id !== c.id))}><Trash2 className="h-4 w-4" /></Button>}
                  </td>
                </tr>
                {openList === c.id && <tr key={c.id + '-opts'}><td colSpan={6} className="pb-3"><OptionsEditor col={c} onChange={p => upd(c.id, p)} /></td></tr>}
              </>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between">
        <Button size="sm" variant="outline" onClick={add}><Plus className="mr-1 h-4 w-4" />Nova coluna</Button>
        <Button size="sm" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar modelo e aplicar na planilha'}</Button>
      </div>
    </div>
  );
}

function OptionsEditor({ col, onChange }: { col: RenewalColumn; onChange: (p: Partial<RenewalColumn>) => void }) {
  const opts = col.options ?? [];
  const colors = col.optionColors ?? {};
  const renewed = col.renewedOptions ?? [];
  const isStatus = col.field === 'status_renovacao';
  const setOpt = (i: number, v: string) => {
    const old = opts[i]; const n = [...opts]; n[i] = v;
    const nc = { ...colors }; if (old in nc) { nc[v] = nc[old]; delete nc[old]; }
    onChange({ options: n, optionColors: nc, renewedOptions: renewed.map(r => (r === old ? v : r)) });
  };
  return (
    <div className="ml-12 space-y-1 rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-xs font-medium">Opções de "{col.title}"{isStatus && ' — marque quais contam como renovado'}</p>
      {opts.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="color" value={toHex(colors[o])} onChange={e => onChange({ optionColors: { ...colors, [o]: toArgb(e.target.value) } })} className="h-7 w-9 cursor-pointer rounded border border-border" />
          <Input className="h-7 w-72 text-xs" value={o} onChange={e => setOpt(i, e.target.value)} />
          {isStatus && <label className="flex items-center gap-1 text-xs"><Checkbox checked={renewed.includes(o)} onCheckedChange={v => onChange({ renewedOptions: v ? [...renewed, o] : renewed.filter(r => r !== o) })} />conta como renovado</label>}
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onChange({ options: opts.filter((_, j) => j !== i), renewedOptions: renewed.filter(r => r !== o) })}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={() => onChange({ options: [...opts, ''] })}><Plus className="mr-1 h-4 w-4" />Opção</Button>
    </div>
  );
}

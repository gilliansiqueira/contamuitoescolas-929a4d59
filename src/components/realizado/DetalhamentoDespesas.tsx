import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, ChevronUp, Check, X, Layers, ClipboardPaste } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { SingleMonthPicker } from '@/components/SingleMonthPicker';
import { useMonthSync, useRangeSync } from './SharedMonthContext';
import { useExpenseDetail, useExpenseDetailConfig, type DetailItem } from '@/hooks/useExpenseDetail';

interface Props {
  schoolId: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatBRL(num: number) {
  if (!isFinite(num)) num = 0;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRL(s: string) {
  const digits = (s || '').replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Converte "1.234,56" / "1234.56" / "1234" em número. */
function parseValorTexto(s: string) {
  let t = (s || '').replace(/[R$\s]/gi, '');
  if (!t) return 0;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return isFinite(n) ? n : 0;
}

/** Linhas em MAIÚSCULAS viram grupos; as demais viram itens do último grupo. */
function parsePastedDetail(text: string) {
  const lines = text.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim());
  const result: { grupo: string; itens: { descricao: string; valor: number }[] }[] = [];
  let current: (typeof result)[number] | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    const letters = line.replace(/[^A-Za-zÀ-ÿ]/g, '');
    const isGroup = letters.length > 0 && letters === letters.toUpperCase() && !/[a-zà-ÿ]/.test(letters);

    if (isGroup) {
      current = { grupo: line.replace(/[\t;]+.*$/, '').trim(), itens: [] };
      result.push(current);
      continue;
    }

    if (!current) { current = { grupo: 'GERAL', itens: [] }; result.push(current); }

    let descricao = line;
    let valor = 0;
    const parts = line.split(/\t|;/).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      descricao = parts[0];
      valor = parseValorTexto(parts[parts.length - 1]);
    } else {
      const m = line.match(/^(.*?)[\s-]+(R?\$?\s*[\d.,]+)$/);
      if (m) { descricao = m[1].trim(); valor = parseValorTexto(m[2]); }
    }
    if (descricao) current.itens.push({ descricao, valor });
  }
  return result.filter(b => b.grupo);
}

interface ItemDraft {
  id?: string;
  descricao: string;
  valor: string;
  data: string;
}

export function DetalhamentoDespesas({ schoolId }: Props) {
  const { label } = useExpenseDetailConfig(schoolId);
  const { groups, items, isLoading, addGroup, renameGroup, moveGroup, deleteGroup, saveItem, deleteItem, pasteImport } =
    useExpenseDetail(schoolId);

  const [mesFilter, setMesFilter] = useState('all');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [draft, setDraft] = useState<{ groupId: string; item: ItemDraft } | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const currentYM = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { const m = i.data?.slice(0, 7); if (m?.length === 7) set.add(m); });
    return Array.from(set).sort();
  }, [items]);

  const selectedList = useMemo(() => {
    if (!mesFilter || mesFilter === 'all') return [] as string[];
    return mesFilter.split(',').map(s => s.trim()).filter(Boolean);
  }, [mesFilter]);
  const effectiveMonths = selectedList.length ? selectedList : [currentYM];

  const pushShared = useMonthSync(selectedList.length === 1 ? selectedList[0] : null, m => setMesFilter(m));
  useRangeSync(mesFilter, r => setMesFilter(r));

  const filtered = useMemo(() => {
    const set = new Set(effectiveMonths);
    return items.filter(i => set.has(i.data?.slice(0, 7)));
  }, [items, effectiveMonths.join(',')]);

  const byGroup = useMemo(() => {
    const map: Record<string, DetailItem[]> = {};
    filtered.forEach(i => {
      if (!map[i.group_id]) map[i.group_id] = [];
      map[i.group_id].push(i);
    });
    return map;
  }, [filtered]);

  const totalGeral = useMemo(() => filtered.reduce((s, i) => s + i.valor, 0), [filtered]);

  const chartData = useMemo(
    () =>
      groups
        .map(g => {
          const total = (byGroup[g.id] || []).reduce((s, i) => s + i.valor, 0);
          return { name: g.name, value: total, label: formatCurrency(total) };
        })
        .filter(d => d.value > 0)
        .sort((a, b) => a.value - b.value),
    [groups, byGroup]
  );

  const startNewItem = (groupId: string) => {
    setOpenGroups(p => ({ ...p, [groupId]: true }));
    const month = effectiveMonths[effectiveMonths.length - 1];
    const today = todayISO();
    const data = today.startsWith(month) ? today : `${month}-01`;
    setDraft({ groupId, item: { descricao: '', valor: '', data } });
  };

  const handleSaveDraft = async () => {
    if (!draft) return;
    const valor = parseBRL(draft.item.valor);
    if (!draft.item.descricao.trim()) { toast.error('Informe a descrição'); return; }
    if (!draft.item.data) { toast.error('Informe a data'); return; }
    try {
      await saveItem.mutateAsync({
        id: draft.item.id,
        group_id: draft.groupId,
        descricao: draft.item.descricao.trim(),
        valor,
        data: draft.item.data,
      });
      setDraft(null);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filtro + ações */}
      <div className="flex items-center gap-3 flex-wrap">
        <SingleMonthPicker
          multi
          value={mesFilter === 'all' ? '' : mesFilter}
          onChange={m => {
            const v = m || 'all';
            setMesFilter(v);
            const list = m ? m.split(',') : [];
            if (list.length === 1) pushShared(list[0]);
          }}
          availableMonths={mesesDisponiveis}
          allowEmpty
          emptyLabel="Mês atual"
        />
        <div className="ml-auto flex items-center gap-2">
          {addingGroup ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                className="rounded-xl h-9 w-48"
                placeholder={`Nome do grupo`}
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && newGroupName.trim()) {
                    await addGroup.mutateAsync(newGroupName.trim());
                    setNewGroupName('');
                    setAddingGroup(false);
                  }
                  if (e.key === 'Escape') { setAddingGroup(false); setNewGroupName(''); }
                }}
              />
              <Button
                size="sm"
                className="rounded-xl"
                onClick={async () => {
                  if (!newGroupName.trim()) return;
                  await addGroup.mutateAsync(newGroupName.trim());
                  setNewGroupName('');
                  setAddingGroup(false);
                }}
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => { setAddingGroup(false); setNewGroupName(''); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <>
              <Button size="sm" variant="outline" className="rounded-xl gap-2" onClick={() => setShowPaste(v => !v)}>
                <ClipboardPaste className="w-4 h-4" /> Colar lista
              </Button>
              <Button size="sm" className="rounded-xl gap-2" onClick={() => setAddingGroup(true)}>
                <Plus className="w-4 h-4" /> Novo grupo
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Colar lista */}
      {showPaste && (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="p-5 space-y-3">
            <p className="text-xs text-muted-foreground">
              Cole a lista: linhas em MAIÚSCULAS viram grupos, as linhas abaixo viram itens. O valor pode vir no fim da linha
              (ex.: <code>Pedreiro 1.500,00</code>) ou em outra coluna colada do Excel. Os itens entram na data{' '}
              <strong>{(() => { const month = effectiveMonths[effectiveMonths.length - 1]; const t = todayISO(); return (t.startsWith(month) ? t : `${month}-01`).split('-').reverse().join('/'); })()}</strong>.
            </p>
            <Textarea
              autoFocus
              rows={8}
              className="rounded-xl font-mono text-sm"
              placeholder={'OBRA SALA\nPedreiro\t1.500,00\nMóveis\t300,00\nOBRA BANHEIRO\nPedreiro\t59,00'}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="rounded-xl gap-2"
                disabled={pasteImport.isPending}
                onClick={async () => {
                  const parsed = parsePastedDetail(pasteText);
                  if (!parsed.length) { toast.error('Nada para importar'); return; }
                  const month = effectiveMonths[effectiveMonths.length - 1];
                  const today = todayISO();
                  const data = today.startsWith(month) ? today : `${month}-01`;
                  try {
                    await pasteImport.mutateAsync({ parsed, data });
                    const totalItens = parsed.reduce((s, b) => s + b.itens.length, 0);
                    toast.success(`${parsed.length} grupo(s) e ${totalItens} item(ns) importados`);
                    setPasteText('');
                    setShowPaste(false);
                  } catch (e: any) {
                    toast.error(e?.message || 'Erro ao importar');
                  }
                }}
              >
                <Check className="w-4 h-4" /> Importar
              </Button>
              <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => { setShowPaste(false); setPasteText(''); }}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Total */}
      <Card className="rounded-2xl bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
        <CardContent className="p-5 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total em {label}</p>
            <p className="text-2xl font-bold">{formatCurrency(totalGeral)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico por grupo */}
      {chartData.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-4">{label} — total por grupo</h3>
            <ResponsiveContainer width="100%" height={Math.max(chartData.length * 48, 140)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 140, top: 4, bottom: 4 }}>
                <XAxis type="number" hide domain={[0, (dataMax: number) => dataMax * 1.05]} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }} width={150} interval={0} />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), 'Total']}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={28} fill="hsl(var(--primary))">
                  <LabelList dataKey="label" position="right" style={{ fontSize: 11, fill: 'hsl(var(--foreground))', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Grupos */}
      {groups.length === 0 && (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum grupo criado ainda. Clique em <strong>Novo grupo</strong> para começar.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {groups.map((g, idx) => {
          const groupItems = byGroup[g.id] || [];
          const total = groupItems.reduce((s, i) => s + i.valor, 0);
          const open = openGroups[g.id] ?? false;
          return (
            <motion.div key={g.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 p-4">
                  <button className="p-1" onClick={() => setOpenGroups(p => ({ ...p, [g.id]: !open }))}>
                    {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  {renaming?.id === g.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        autoFocus
                        className="rounded-xl h-9 max-w-xs"
                        value={renaming.value}
                        onChange={e => setRenaming({ id: g.id, value: e.target.value })}
                        onKeyDown={async e => {
                          if (e.key === 'Enter' && renaming.value.trim()) {
                            await renameGroup.mutateAsync({ id: g.id, name: renaming.value.trim() });
                            setRenaming(null);
                          }
                          if (e.key === 'Escape') setRenaming(null);
                        }}
                      />
                      <Button
                        size="sm"
                        className="rounded-xl"
                        onClick={async () => {
                          if (!renaming.value.trim()) return;
                          await renameGroup.mutateAsync({ id: g.id, name: renaming.value.trim() });
                          setRenaming(null);
                        }}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setRenaming(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="font-semibold flex-1 truncate">{g.name}</span>
                      <span className="font-bold whitespace-nowrap">{formatCurrency(total)}</span>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" disabled={idx === 0} onClick={() => moveGroup.mutate({ id: g.id, dir: -1 })}>
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" disabled={idx === groups.length - 1} onClick={() => moveGroup.mutate({ id: g.id, dir: 1 })}>
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => setRenaming({ id: g.id, value: g.name })}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-lg text-destructive"
                          onClick={() => {
                            if (confirm(`Remover o grupo "${g.name}" e todos os seus itens?`)) deleteGroup.mutate(g.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                {open && (
                  <div className="border-t px-4 py-3 space-y-2">
                    {groupItems.length === 0 && !draft && (
                      <p className="text-xs text-muted-foreground py-2">Nenhum item neste período.</p>
                    )}

                    {groupItems.map(item =>
                      draft?.item.id === item.id ? (
                        <ItemEditor
                          key={item.id}
                          draft={draft.item}
                          onChange={d => setDraft({ groupId: draft.groupId, item: d })}
                          onSave={handleSaveDraft}
                          onCancel={() => setDraft(null)}
                        />
                      ) : (
                        <div key={item.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-border/40 last:border-0">
                          <span className="text-xs text-muted-foreground w-20 shrink-0">
                            {item.data.split('-').reverse().join('/')}
                          </span>
                          <span className="flex-1 truncate">{item.descricao}</span>
                          <span className="font-medium whitespace-nowrap">{formatCurrency(item.valor)}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-lg"
                            onClick={() =>
                              setDraft({
                                groupId: item.group_id,
                                item: { id: item.id, descricao: item.descricao, valor: formatBRL(item.valor), data: item.data },
                              })
                            }
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-lg text-destructive"
                            onClick={() => { if (confirm('Remover este item?')) deleteItem.mutate(item.id); }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )
                    )}

                    {draft && draft.groupId === g.id && !draft.item.id && (
                      <ItemEditor
                        draft={draft.item}
                        onChange={d => setDraft({ groupId: g.id, item: d })}
                        onSave={handleSaveDraft}
                        onCancel={() => setDraft(null)}
                      />
                    )}

                    <Button size="sm" variant="outline" className="rounded-xl gap-2 mt-2" onClick={() => startNewItem(g.id)}>
                      <Plus className="w-3.5 h-3.5" /> Novo item
                    </Button>
                  </div>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function ItemEditor({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  draft: ItemDraft;
  onChange: (d: ItemDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap py-2">
      <Input
        type="date"
        className="rounded-xl h-9 w-36"
        value={draft.data}
        onChange={e => onChange({ ...draft, data: e.target.value })}
      />
      <Input
        autoFocus
        className="rounded-xl h-9 flex-1 min-w-[160px]"
        placeholder="Descrição"
        value={draft.descricao}
        onChange={e => onChange({ ...draft, descricao: e.target.value })}
        onKeyDown={e => e.key === 'Enter' && onSave()}
      />
      <Input
        className="rounded-xl h-9 w-32"
        inputMode="decimal"
        placeholder="0,00"
        value={draft.valor}
        onChange={e => onChange({ ...draft, valor: formatBRL(parseBRL(e.target.value)) })}
        onKeyDown={e => e.key === 'Enter' && onSave()}
      />
      <Button size="sm" className="rounded-xl" onClick={onSave}><Check className="w-4 h-4" /></Button>
      <Button size="sm" variant="ghost" className="rounded-xl" onClick={onCancel}><X className="w-4 h-4" /></Button>
    </div>
  );
}

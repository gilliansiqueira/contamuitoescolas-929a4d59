import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Check,
  X,
  Layers,
  ClipboardPaste,
  Table2,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { SingleMonthPicker } from '@/components/SingleMonthPicker';
import { useMonthSync, useRangeSync } from './SharedMonthContext';
import { useExpenseDetail, useExpenseDetailConfig, type DetailItem, type DetailTipo } from '@/hooks/useExpenseDetail';

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
  const n = parseFloat(t.replace(/[^\d.-]/g, ''));
  return isFinite(n) ? Math.abs(n) : 0;
}

function parseTipoTexto(s: string): DetailTipo {
  const t = (s || '').trim().toLowerCase();
  if (t.startsWith('r') || t.startsWith('e') || t.includes('entrada') || t.includes('receb')) return 'receita';
  return 'despesa';
}

/** Aceita 05/09/2026, 2026-09-05, 5/9/26. Retorna ISO ou ''. */
function parseDataTexto(s: string, fallbackMonth: string) {
  const t = (s || '').trim();
  if (!t) return fallbackMonth ? `${fallbackMonth}-01` : '';
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return t;
  m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    let y = m[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${mo}-${d}`;
  }
  m = t.match(/^(\d{1,2})[/\-.](\d{1,2})$/);
  if (m && fallbackMonth) return `${fallbackMonth.slice(0, 4)}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

/** Linhas em MAIÚSCULAS viram grupos; as demais viram itens do último grupo. */
function parsePastedDetail(text: string) {
  const lines = text.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim());
  const result: { grupo: string; itens: { descricao: string; valor: number; tipo: DetailTipo }[] }[] = [];
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
    let tipo: DetailTipo = 'despesa';
    const parts = line.split(/\t|;/).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      descricao = parts[0];
      valor = parseValorTexto(parts[parts.length - 1]);
      if (parts.length > 2) tipo = parseTipoTexto(parts[parts.length - 2]);
    } else {
      const m = line.match(/^(.*?)[\s-]+(R?\$?\s*[\d.,]+)$/);
      if (m) { descricao = m[1].trim(); valor = parseValorTexto(m[2]); }
    }
    if (descricao) current.itens.push({ descricao, valor, tipo });
  }
  return result.filter(b => b.grupo);
}

export interface SheetRow {
  id?: string;
  grupo: string;
  data: string;
  descricao: string;
  tipo: DetailTipo;
  valor: string;
}

/** Colunas: centro de custo, data, descrição, tipo, valor. */
function parseSpreadsheet(text: string, fallbackMonth: string) {
  const rows: SheetRow[] = [];
  const warnings: string[] = [];
  const lines = text.split('\n').filter(l => l.trim());

  lines.forEach((raw, idx) => {
    const parts = raw.split(/\t|;/).map(p => p.trim());
    const first = (parts[0] || '').toLowerCase();
    if (idx === 0 && (first.includes('centro') || first.includes('grupo'))) return; // cabeçalho
    if (parts.length < 3) {
      warnings.push(`Linha ${idx + 1} ignorada (menos de 3 colunas)`);
      return;
    }
    const grupo = parts[0];
    if (!grupo) { warnings.push(`Linha ${idx + 1} ignorada (sem centro de custo)`); return; }

    const data = parseDataTexto(parts[1], fallbackMonth);
    if (!data) { warnings.push(`Linha ${idx + 1} ignorada (data inválida: "${parts[1]}")`); return; }

    const descricao = parts[2];
    if (!descricao) { warnings.push(`Linha ${idx + 1} ignorada (sem descrição)`); return; }

    const hasTipo = parts.length >= 5;
    const tipo = hasTipo ? parseTipoTexto(parts[3]) : 'despesa';
    const valor = parseValorTexto(parts[hasTipo ? 4 : 3]);

    rows.push({ grupo, data, descricao, tipo, valor: formatBRL(valor) });
  });

  return { rows, warnings };
}

/** Remove sufixos entre parênteses, ex. "(total da atividade)". */
function stripParens(s: string) {
  return (s || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/** "Expedição Peru - Guias locais (total da atividade)" -> { atividade: 'Expedição Peru', tipo: 'Guias locais' } */
function splitDescricao(d: string) {
  const clean = stripParens((d || '').trim());
  const m = clean.match(/^(.*?)\s+[-–—]\s+(.*)$/);
  if (m && m[1].trim()) return { atividade: m[1].trim(), tipo: stripParens(m[2]) || 'Geral' };
  return { atividade: clean || 'Sem descrição', tipo: 'Geral' };
}

function normKey(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const PREFIXO_ATIVIDADE_RE = /^(caiaque|caique|remada caiçara|remada|expedição|expedicao|passeio|tour|trilha)\s*(?:de|do|da|dos|das|em|no|na|nos|nas|ao|à|às|a|e|para|pra)?\s*[-–—:.,;]?\s*/i;

/** Remove prefixos genéricos (Caiaque, Expedição, Remada Caiçara etc.) do início do nome. */
function cleanActivityName(s: string) {
  if (!s) return s;
  let t = s.trim();
  let changed = true;
  while (changed) {
    const prev = t;
    t = t.replace(PREFIXO_ATIVIDADE_RE, '');
    t = t.replace(/^(de|do|da|dos|das|em|no|na|nos|nas|ao|à|às|a|e|para|pra)\s+/i, '');
    t = t.replace(/^[-–—:.,;\s]+/, '');
    changed = t !== prev;
  }
  t = t.replace(/^\((.*)\)\s*$/, '$1').trim();
  return t || s;
}

interface ItemDraft {
  id?: string;
  descricao: string;
  valor: string;
  data: string;
  tipo: DetailTipo;
}

export function DetalhamentoDespesas({ schoolId }: Props) {
  const { label } = useExpenseDetailConfig(schoolId);
  const {
    groups,
    items,
    isLoading,
    addGroup,
    renameGroup,
    moveGroup,
    deleteGroup,
    saveItem,
    deleteItem,
    pasteImport,
    bulkSaveItems,
  } = useExpenseDetail(schoolId);

  const [mesFilter, setMesFilter] = useState('all');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [openDetail, setOpenDetail] = useState<Record<string, DetailTipo | null>>({});
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [draft, setDraft] = useState<{ groupId: string; item: ItemDraft } | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteMode, setPasteMode] = useState<'colunas' | 'lista'>('colunas');
  const [pasteText, setPasteText] = useState('');
  const [showSheet, setShowSheet] = useState(false);
  const [sheetRows, setSheetRows] = useState<SheetRow[]>([]);
  const [sortBy, setSortBy] = useState<'manual' | 'value-desc' | 'value-asc' | 'name-asc' | 'name-desc'>('manual');
  const [agrupado, setAgrupado] = useState(true);

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
  /**
   * Sem seleção explícita ("todos"): considera TODOS os meses com lançamentos,
   * em vez de apenas um mês — evita a aba aparecer vazia/parcial.
   */
  const fallbackMonths = useMemo(() => {
    if (!mesesDisponiveis.length) return [currentYM];
    return mesesDisponiveis;
  }, [mesesDisponiveis, currentYM]);
  const effectiveMonths = selectedList.length ? selectedList : fallbackMonths;


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

  const defaultData = useMemo(() => {
    const month = effectiveMonths[effectiveMonths.length - 1];
    const today = todayISO();
    return today.startsWith(month) ? today : `${month}-01`;
  }, [effectiveMonths.join(',')]);

  const sortedGroups = useMemo(() => {
    const withTotal = groups.map(g => {
      const list = byGroup[g.id] || [];
      const receitas = list.filter(i => i.tipo === 'receita').reduce((s, i) => s + i.valor, 0);
      const despesas = list.filter(i => i.tipo !== 'receita').reduce((s, i) => s + i.valor, 0);
      return { ...g, receitas, despesas, resultado: receitas - despesas, total: receitas - despesas };
    });
    switch (sortBy) {
      case 'value-desc':
        return withTotal.sort((a, b) => b.resultado - a.resultado);
      case 'value-asc':
        return withTotal.sort((a, b) => a.resultado - b.resultado);
      case 'name-asc':
        return withTotal.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
      case 'name-desc':
        return withTotal.sort((a, b) => b.name.localeCompare(a.name, 'pt-BR', { sensitivity: 'base' }));
      default:
        return withTotal;
    }
  }, [groups, byGroup, sortBy]);

  const totalReceitas = useMemo(
    () => filtered.filter(i => i.tipo === 'receita').reduce((s, i) => s + i.valor, 0),
    [filtered]
  );
  const totalDespesas = useMemo(
    () => filtered.filter(i => i.tipo !== 'receita').reduce((s, i) => s + i.valor, 0),
    [filtered]
  );
  const totalResultado = totalReceitas - totalDespesas;

  const chartData = useMemo(
    () =>
      sortedGroups
        .filter(g => g.receitas > 0 || g.despesas > 0)
        .map(g => ({ name: g.name, value: g.resultado, label: formatCurrency(g.resultado) })),
    [sortedGroups]
  );

  const startNewItem = (groupId: string, tipo: DetailTipo) => {
    setOpenGroups(p => ({ ...p, [groupId]: true }));
    setOpenDetail(p => ({ ...p, [groupId]: tipo }));
    setDraft({ groupId, item: { descricao: '', valor: '', data: defaultData, tipo } });
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
        tipo: draft.item.tipo,
      });
      setDraft(null);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    }
  };

  /** Linha de um lançamento (com editor inline quando em edição). */
  const renderItemRow = (item: DetailItem, showFullLabel = true) => {
    if (draft?.item.id === item.id) {
      return (
        <ItemEditor
          key={item.id}
          draft={draft.item}
          onChange={d => setDraft({ groupId: draft.groupId, item: d })}
          onSave={handleSaveDraft}
          onCancel={() => setDraft(null)}
        />
      );
    }
    return (
      <div key={item.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-border/40 last:border-0">
        <span className="text-xs text-muted-foreground w-20 shrink-0">
          {item.data.split('-').reverse().join('/')}
        </span>
        <span className="flex-1 truncate">
          {showFullLabel ? item.descricao : splitDescricao(item.descricao).tipo}
        </span>
        <span className={`font-medium whitespace-nowrap ${item.tipo === 'receita' ? 'text-emerald-600' : ''}`}>
          {formatCurrency(item.valor)}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-lg"
          onClick={() =>
            setDraft({
              groupId: item.group_id,
              item: {
                id: item.id,
                descricao: item.descricao,
                valor: formatBRL(item.valor),
                data: item.data,
                tipo: item.tipo,
              },
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
    );
  };

  const openSheet = () => {
    const rows: SheetRow[] = filtered
      .slice()
      .sort((a, b) => a.data.localeCompare(b.data))
      .map(i => ({
        id: i.id,
        grupo: groups.find(g => g.id === i.group_id)?.name || '',
        data: i.data,
        descricao: i.descricao,
        tipo: i.tipo,
        valor: formatBRL(i.valor),
      }));
    for (let n = 0; n < 3; n++) rows.push({ grupo: '', data: defaultData, descricao: '', tipo: 'despesa', valor: '' });
    setSheetRows(rows);
    setShowSheet(true);
    setShowPaste(false);
  };

  const saveSheet = async () => {
    const valid = sheetRows.filter(r => r.grupo.trim() && r.descricao.trim() && r.data);
    if (!valid.length) { toast.error('Nenhuma linha preenchida'); return; }
    try {
      await bulkSaveItems.mutateAsync(
        valid.map(r => ({
          id: r.id,
          grupo: r.grupo.trim(),
          data: r.data,
          descricao: r.descricao.trim(),
          tipo: r.tipo,
          valor: parseBRL(r.valor),
        }))
      );
      toast.success(`${valid.length} linha(s) salva(s)`);
      // Ajusta o filtro para os meses recém-salvos, senão a tela parece vazia.
      const savedMonths = Array.from(new Set(valid.map(r => r.data.slice(0, 7)))).sort();
      const visible = new Set(effectiveMonths);
      if (savedMonths.length && !savedMonths.some(m => visible.has(m))) {
        setMesFilter(savedMonths.join(','));
      }
      setShowSheet(false);
      setSheetRows([]);
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
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="h-9 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="manual">Ordenação manual</option>
          <option value="value-desc">Maior resultado</option>
          <option value="value-asc">Menor resultado</option>
          <option value="name-asc">A a Z</option>
          <option value="name-desc">Z a A</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          {addingGroup ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                className="rounded-xl h-9 w-48"
                placeholder="Nome do centro de custo"
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
              <Button size="sm" variant="outline" className="rounded-xl gap-2" onClick={openSheet}>
                <Table2 className="w-4 h-4" /> Planilha
              </Button>
              <Button size="sm" variant="outline" className="rounded-xl gap-2" onClick={() => { setShowPaste(v => !v); setShowSheet(false); }}>
                <ClipboardPaste className="w-4 h-4" /> Colar
              </Button>
              <Button size="sm" className="rounded-xl gap-2" onClick={() => setAddingGroup(true)}>
                <Plus className="w-4 h-4" /> Novo centro
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Colar do Excel / lista */}
      {showPaste && (
        <PastePanel
          mode={pasteMode}
          onModeChange={setPasteMode}
          text={pasteText}
          onTextChange={setPasteText}
          defaultData={defaultData}
          isPending={pasteImport.isPending || bulkSaveItems.isPending}
          onCancel={() => { setShowPaste(false); setPasteText(''); }}
          onImport={async () => {
            if (pasteMode === 'lista') {
              const parsed = parsePastedDetail(pasteText);
              if (!parsed.length) { toast.error('Nada para importar'); return; }
              try {
                await pasteImport.mutateAsync({ parsed, data: defaultData });
                const totalItens = parsed.reduce((s, b) => s + b.itens.length, 0);
                toast.success(`${parsed.length} centro(s) e ${totalItens} item(ns) importados`);
                setPasteText('');
                setShowPaste(false);
              } catch (e: any) {
                toast.error(e?.message || 'Erro ao importar');
              }
              return;
            }
            const { rows, warnings } = parseSpreadsheet(pasteText, effectiveMonths[effectiveMonths.length - 1]);
            if (!rows.length) { toast.error(warnings[0] || 'Nada para importar'); return; }
            setSheetRows([...rows, { grupo: '', data: defaultData, descricao: '', tipo: 'despesa', valor: '' }]);
            setShowSheet(true);
            setShowPaste(false);
            setPasteText('');
            if (warnings.length) toast.warning(`${warnings.length} linha(s) ignorada(s): ${warnings[0]}`);
            else toast.success(`${rows.length} linha(s) prontas — confira e salve`);
          }}
        />
      )}

      {/* Grade editável */}
      {showSheet && (
        <SheetPanel
          rows={sheetRows}
          onChange={setSheetRows}
          groups={groups.map(g => g.name)}
          defaultData={defaultData}
          isPending={bulkSaveItems.isPending}
          onSave={saveSheet}
          onCancel={() => { setShowSheet(false); setSheetRows([]); }}
        />
      )}

      {/* Fechamento geral */}
      <Card className="rounded-2xl bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
        <CardContent className="p-5 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm font-semibold">{label} — fechamento</p>
          </div>
          <div className="flex items-center gap-8 flex-wrap">
            <Metric titulo="Receitas" valor={formatCurrency(totalReceitas)} tone="pos" />
            <Metric titulo="Despesas" valor={formatCurrency(totalDespesas)} tone="neg" />
            <Metric titulo="Resultado" valor={formatCurrency(totalResultado)} tone={totalResultado >= 0 ? 'pos' : 'neg'} big />
            <Metric titulo="Margem" valor={margemLabel(totalResultado, totalReceitas)} />
          </div>
        </CardContent>
      </Card>

      {/* Gráfico por centro de custo */}
      {chartData.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-4">{label} — resultado por centro de custo</h3>
            <ResponsiveContainer width="100%" height={Math.max(chartData.length * 48, 140)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 160, top: 4, bottom: 4 }}>
                <XAxis type="number" hide domain={[(min: number) => Math.min(0, min * 1.1), (dataMax: number) => dataMax * 1.1]} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }} width={150} interval={0} />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), 'Resultado']}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={28}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.value >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'} />
                  ))}
                  <LabelList
                    dataKey="label"
                    content={(props: any) => {
                      const { x, y, width, value } = props;
                      if (x == null || y == null) return null;
                      const labelX = (x as number) + (Number(width) || 0) + 6;
                      return (
                        <text
                          x={labelX}
                          y={(y as number) + 14}
                          textAnchor="start"
                          dominantBaseline="middle"
                          style={{ fontSize: 11, fill: 'hsl(var(--foreground))', fontWeight: 600 }}
                        >
                          {value}
                        </text>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Centros de custo */}
      {groups.length === 0 && (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum centro de custo criado ainda. Clique em <strong>Novo centro</strong> ou use a <strong>Planilha</strong> para começar.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {sortedGroups.map((g, idx) => {
          const groupItems = byGroup[g.id] || [];
          const open = openGroups[g.id] ?? false;
          const detailTipo = openDetail[g.id] ?? null;
          const detailItems = groupItems.filter(i =>
            detailTipo === 'receita' ? i.tipo === 'receita' : detailTipo === 'despesa' ? i.tipo !== 'receita' : false
          );
          const manualOrder = sortBy === 'manual';
          const toggleDetail = (tipo: DetailTipo) => {
            setOpenGroups(p => ({ ...p, [g.id]: true }));
            setOpenDetail(p => ({ ...p, [g.id]: p[g.id] === tipo ? null : tipo }));
          };
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
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" disabled={!manualOrder || idx === 0} onClick={() => moveGroup.mutate({ id: g.id, dir: -1 })}>
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" disabled={!manualOrder || idx === sortedGroups.length - 1} onClick={() => moveGroup.mutate({ id: g.id, dir: 1 })}>
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
                            if (confirm(`Remover o centro de custo "${g.name}" e todos os seus itens?`)) deleteGroup.mutate(g.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                {/* Fechamento do centro */}
                <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    className={`text-left rounded-xl border p-3 transition-colors hover:bg-muted/50 ${detailTipo === 'receita' ? 'border-primary bg-primary/5' : 'border-border'}`}
                    onClick={() => toggleDetail('receita')}
                  >
                    <p className="text-[11px] text-muted-foreground font-medium">Receitas</p>
                    <p className="text-base font-bold text-emerald-600">{formatCurrency(g.receitas)}</p>
                  </button>
                  <button
                    className={`text-left rounded-xl border p-3 transition-colors hover:bg-muted/50 ${detailTipo === 'despesa' ? 'border-primary bg-primary/5' : 'border-border'}`}
                    onClick={() => toggleDetail('despesa')}
                  >
                    <p className="text-[11px] text-muted-foreground font-medium">Despesas</p>
                    <p className="text-base font-bold text-destructive">{formatCurrency(g.despesas)}</p>
                  </button>
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-[11px] text-muted-foreground font-medium">Resultado</p>
                    <p className={`text-base font-bold ${g.resultado >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {formatCurrency(g.resultado)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-[11px] text-muted-foreground font-medium">Margem</p>
                    <p className="text-base font-bold">{margemLabel(g.resultado, g.receitas)}</p>
                  </div>
                </div>

                {open && (
                  <div className="border-t px-4 py-3 space-y-2">
                    {detailTipo === null && (
                      <p className="text-xs text-muted-foreground py-1">
                        Clique em <strong>Receitas</strong> ou <strong>Despesas</strong> para ver o detalhamento.
                      </p>
                    )}

                    {detailTipo && (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-muted-foreground">
                            {detailTipo === 'receita' ? 'Receitas' : 'Despesas'} do período
                          </p>
                          <Button
                            size="sm"
                            variant={agrupado ? 'default' : 'outline'}
                            className="rounded-xl h-7 text-xs gap-1"
                            onClick={() => setAgrupado(v => !v)}
                          >
                            <Layers className="w-3.5 h-3.5" /> {agrupado ? 'Agrupado' : 'Lista completa'}
                          </Button>
                        </div>

                        {detailItems.length === 0 && !draft && (
                          <p className="text-xs text-muted-foreground py-2">Nenhum lançamento neste período.</p>
                        )}

                        {agrupado ? (
                          <GroupedDetail key={`${g.id}-${detailTipo}`} items={detailItems} renderItemRow={renderItemRow} />
                        ) : (
                          <>
                            <GroupChart items={detailItems} />
                            {detailItems.map(item => renderItemRow(item))}
                          </>
                        )}


                        {draft && draft.groupId === g.id && !draft.item.id && (
                          <ItemEditor
                            draft={draft.item}
                            onChange={d => setDraft({ groupId: g.id, item: d })}
                            onSave={handleSaveDraft}
                            onCancel={() => setDraft(null)}
                          />
                        )}

                        <Button size="sm" variant="outline" className="rounded-xl gap-2 mt-2" onClick={() => startNewItem(g.id, detailTipo)}>
                          <Plus className="w-3.5 h-3.5" /> Novo lançamento
                        </Button>
                      </>
                    )}
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

function margemLabel(resultado: number, receitas: number) {
  if (!receitas) return '—';
  return `${((resultado / receitas) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function Metric({ titulo, valor, tone, big }: { titulo: string; valor: string; tone?: 'pos' | 'neg'; big?: boolean }) {
  const color = tone === 'pos' ? 'text-emerald-600' : tone === 'neg' ? 'text-destructive' : '';
  return (
    <div>
      <p className="text-xs text-muted-foreground font-medium">{titulo}</p>
      <p className={`${big ? 'text-2xl' : 'text-lg'} font-bold ${color}`}>{valor}</p>
    </div>
  );
}

function PastePanel({
  mode,
  onModeChange,
  text,
  onTextChange,
  defaultData,
  isPending,
  onImport,
  onCancel,
}: {
  mode: 'colunas' | 'lista';
  onModeChange: (m: 'colunas' | 'lista') => void;
  text: string;
  onTextChange: (t: string) => void;
  defaultData: string;
  isPending: boolean;
  onImport: () => void;
  onCancel: () => void;
}) {
  return (
    <Card className="rounded-2xl border-dashed">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant={mode === 'colunas' ? 'default' : 'outline'} className="rounded-xl" onClick={() => onModeChange('colunas')}>
            Colunas do Excel
          </Button>
          <Button size="sm" variant={mode === 'lista' ? 'default' : 'outline'} className="rounded-xl" onClick={() => onModeChange('lista')}>
            Lista (MAIÚSCULAS)
          </Button>
        </div>
        {mode === 'colunas' ? (
          <p className="text-xs text-muted-foreground">
            Copie do Excel as colunas nesta ordem: <strong>centro de custo, data, descrição, tipo (receita/despesa), valor</strong>.
            Sem a coluna de tipo, a linha entra como despesa. Depois de colar, você confere tudo na planilha antes de salvar.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Linhas em MAIÚSCULAS viram centros de custo; as de baixo viram lançamentos. Os itens entram na data{' '}
            <strong>{defaultData.split('-').reverse().join('/')}</strong> como despesa (use uma coluna com "receita" para marcar entradas).
          </p>
        )}
        <Textarea
          autoFocus
          rows={8}
          className="rounded-xl font-mono text-sm"
          placeholder={
            mode === 'colunas'
              ? 'Atacama\t05/09/2026\tVenda balcão\treceita\t1.000,00\nAtacama\t06/09/2026\tPedreiro\tdespesa\t100,00'
              : 'ATACAMA\nVenda balcão\treceita\t1.000,00\nPedreiro\tdespesa\t100,00'
          }
          value={text}
          onChange={e => onTextChange(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <Button size="sm" className="rounded-xl gap-2" disabled={isPending} onClick={onImport}>
            <Check className="w-4 h-4" /> {mode === 'colunas' ? 'Conferir na planilha' : 'Importar'}
          </Button>
          <Button size="sm" variant="ghost" className="rounded-xl" onClick={onCancel}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SheetPanel({
  rows,
  onChange,
  groups,
  defaultData,
  isPending,
  onSave,
  onCancel,
}: {
  rows: SheetRow[];
  onChange: (r: SheetRow[]) => void;
  groups: string[];
  defaultData: string;
  isPending: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const update = (idx: number, patch: Partial<SheetRow>) =>
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const addRow = () =>
    onChange([...rows, { grupo: rows[rows.length - 1]?.grupo || '', data: defaultData, descricao: '', tipo: 'despesa', valor: '' }]);

  const totalReceita = rows.reduce((s, r) => (r.tipo === 'receita' ? s + parseBRL(r.valor) : s), 0);
  const totalDespesa = rows.reduce((s, r) => (r.tipo !== 'receita' ? s + parseBRL(r.valor) : s), 0);

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Table2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Planilha de lançamentos</h3>
          <span className="text-xs text-muted-foreground">
            Receitas {formatCurrency(totalReceita)} · Despesas {formatCurrency(totalDespesa)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground text-left">
                <th className="py-2 pr-2 font-medium min-w-[160px]">Centro de custo</th>
                <th className="py-2 pr-2 font-medium w-36">Data</th>
                <th className="py-2 pr-2 font-medium min-w-[200px]">Descrição</th>
                <th className="py-2 pr-2 font-medium w-32">Tipo</th>
                <th className="py-2 pr-2 font-medium w-32">Valor</th>
                <th className="py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} className="border-t border-border/40">
                  <td className="py-1 pr-2">
                    <Input
                      list="centros-custo-lista"
                      className="rounded-lg h-8"
                      value={r.grupo}
                      onChange={e => update(idx, { grupo: e.target.value })}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Input type="date" className="rounded-lg h-8" value={r.data} onChange={e => update(idx, { data: e.target.value })} />
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      className="rounded-lg h-8"
                      value={r.descricao}
                      onChange={e => update(idx, { descricao: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter' && idx === rows.length - 1) addRow(); }}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={r.tipo}
                      onChange={e => update(idx, { tipo: e.target.value as DetailTipo })}
                    >
                      <option value="despesa">Despesa</option>
                      <option value="receita">Receita</option>
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      className="rounded-lg h-8 text-right"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={r.valor}
                      onChange={e => update(idx, { valor: formatBRL(parseBRL(e.target.value)) })}
                      onKeyDown={e => { if (e.key === 'Enter' && idx === rows.length - 1) addRow(); }}
                    />
                  </td>
                  <td className="py-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-lg text-destructive"
                      onClick={() => onChange(rows.filter((_, i) => i !== idx))}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="centros-custo-lista">
            {groups.map(g => <option key={g} value={g} />)}
          </datalist>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="rounded-xl gap-2" onClick={addRow}>
            <Plus className="w-3.5 h-3.5" /> Nova linha
          </Button>
          <Button size="sm" className="rounded-xl gap-2" disabled={isPending} onClick={onSave}>
            <Check className="w-4 h-4" /> Salvar planilha
          </Button>
          <Button size="sm" variant="ghost" className="rounded-xl" onClick={onCancel}>Cancelar</Button>
          <span className="text-xs text-muted-foreground ml-auto">
            Linhas sem centro de custo, descrição ou data são ignoradas. Centros novos são criados automaticamente.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/** Gráfico de barras dos lançamentos (soma por descrição). */
function GroupChart({ items }: { items: DetailItem[] }) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach(i => {
      const { atividade, tipo } = splitDescricao(i.descricao);
      const name = tipo && tipo !== 'Geral'
        ? `${cleanActivityName(atividade)} - ${tipo}`
        : cleanActivityName(atividade) || i.descricao;
      map.set(name, (map.get(name) || 0) + i.valor);
    });
    return Array.from(map, ([name, value]) => ({ name, value, label: formatCurrency(value) }))
      .filter(d => d.value > 0)
      .sort((a, b) => a.value - b.value);
  }, [items]);

  return <AggChart data={data} />;
}

/** Gráfico de barras horizontais a partir de pares nome/valor já somados. */
function AggChart({ data, compact = false }: { data: { name: string; value: number; label: string }[]; compact?: boolean }) {
  if (data.length === 0) return null;
  return (
    <div className={`rounded-xl bg-muted/30 p-3 mb-2 ${compact ? 'mt-1' : ''}`}>
      <ResponsiveContainer width="100%" height={Math.max(data.length * (compact ? 28 : 34), 80)}>
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 110, top: 2, bottom: 2 }}>
          <XAxis type="number" hide domain={[0, (dataMax: number) => dataMax * 1.05]} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: compact ? 10 : 11, fill: 'hsl(var(--muted-foreground))' }}
            width={compact ? 110 : 140}
            interval={0}
          />
          <Tooltip
            formatter={(v: number) => [formatCurrency(v), 'Valor']}
            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={compact ? 14 : 18} fill="hsl(var(--primary))" fillOpacity={0.8}>
            <LabelList dataKey="label" position="right" style={{ fontSize: 10, fill: 'hsl(var(--foreground))', fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Visão agrupada: atividade -> tipo de custo -> lançamentos. */
function GroupedDetail({
  items,
  renderItemRow,
}: {
  items: DetailItem[];
  renderItemRow: (item: DetailItem, showFullLabel?: boolean) => JSX.Element;
}) {
  const [openAtiv, setOpenAtiv] = useState<Record<string, boolean>>({});
  const [openTipo, setOpenTipo] = useState<Record<string, boolean>>({});

  const tree = useMemo(() => {
    const atividades = new Map<
      string,
      { name: string; total: number; tipos: Map<string, { name: string; total: number; itens: DetailItem[] }> }
    >();
    items.forEach(i => {
      const { atividade, tipo } = splitDescricao(i.descricao);
      const atividadeLimpa = cleanActivityName(atividade);
      const aKey = normKey(atividadeLimpa);
      let a = atividades.get(aKey);
      if (!a) { a = { name: atividadeLimpa, total: 0, tipos: new Map() }; atividades.set(aKey, a); }
      a.total += i.valor;
      const tKey = normKey(tipo);
      let t = a.tipos.get(tKey);
      if (!t) { t = { name: tipo, total: 0, itens: [] }; a.tipos.set(tKey, t); }
      t.total += i.valor;
      t.itens.push(i);
    });
    return Array.from(atividades, ([key, a]) => ({
      key,
      name: a.name,
      total: a.total,
      tipos: Array.from(a.tipos, ([tKey, t]) => ({
        key: `${key}::${tKey}`,
        name: t.name,
        total: t.total,
        itens: t.itens.slice().sort((x, y) => x.data.localeCompare(y.data)),
      })).sort((x, y) => y.total - x.total),
    })).sort((x, y) => y.total - x.total);
  }, [items]);

  const chartData = useMemo(
    () => tree.filter(a => a.total > 0).map(a => ({ name: a.name, value: a.total, label: formatCurrency(a.total) })).reverse(),
    [tree]
  );

  if (tree.length === 0) return null;

  return (
    <>
      <AggChart data={chartData} />
      <div className="space-y-1">
        {tree.map(a => {
          const aOpen = openAtiv[a.key] ?? false;
          const tiposChart = a.tipos
            .filter(t => t.total > 0)
            .map(t => ({ name: t.name, value: t.total, label: formatCurrency(t.total) }))
            .reverse();
          return (
            <div key={a.key} className="rounded-xl border border-border/60">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/40 rounded-xl"
                onClick={() => setOpenAtiv(p => ({ ...p, [a.key]: !aOpen }))}
              >
                {aOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                <span className="flex-1 text-left font-medium truncate">{a.name}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">{a.tipos.length} itens</span>
                <span className="font-semibold whitespace-nowrap">{formatCurrency(a.total)}</span>
              </button>

              {aOpen && (
                <div className="px-3 pb-2 space-y-1">
                  {tiposChart.length > 1 && <AggChart data={tiposChart} compact />}
                  {a.tipos.map(t => {
                    const tOpen = openTipo[t.key] ?? false;
                    return (
                      <div key={t.key} className="rounded-lg bg-muted/20">
                        <button
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted/40 rounded-lg"
                          onClick={() => setOpenTipo(p => ({ ...p, [t.key]: !tOpen }))}
                        >
                          {tOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                          <span className="flex-1 text-left truncate">{t.name}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {t.itens.length} {t.itens.length === 1 ? 'lançamento' : 'lançamentos'}
                          </span>
                          <span className="font-medium whitespace-nowrap">{formatCurrency(t.total)}</span>
                        </button>
                        {tOpen && <div className="px-2 pb-2">{t.itens.map(item => renderItemRow(item, false))}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
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
      <select
        className="h-9 rounded-xl border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        value={draft.tipo}
        onChange={e => onChange({ ...draft, tipo: e.target.value as DetailTipo })}
      >
        <option value="despesa">Despesa</option>
        <option value="receita">Receita</option>
      </select>
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

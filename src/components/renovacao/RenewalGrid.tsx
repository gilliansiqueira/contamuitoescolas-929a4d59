import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowDown, ArrowUp, ChevronDown, Plus, Undo2, Search, Columns3, AlertTriangle } from 'lucide-react';
import type { RenewalColumn, RenewalRow, ColType } from '@/lib/renewal/types';
import { cellValue, A_CONFIRMAR, SEM_INFO } from '@/lib/renewal/types';
import { newColId } from '@/lib/renewal/fields';

export interface CellEdit { rowKey: string; colId: string; value: any }

interface Props {
  rows: RenewalRow[];
  columns: RenewalColumn[];
  onEdits: (edits: CellEdit[]) => void;
  onColumnsChange: (cols: RenewalColumn[]) => void;
  onAddRow: () => void;
  onResolveConflict: (rowKey: string, colId: string, keep: 'manual' | 'imported') => void;
}

export function fmtCell(v: any, type: ColType): string {
  if (v == null) return '';
  if (type === 'date' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y, m, d] = v.split('-'); return `${d}/${m}/${y}`; }
  if (type === 'number' && typeof v === 'number') return v.toLocaleString('pt-BR');
  return String(v);
}

function parseInput(s: string, type: ColType): any {
  const t = s.trim();
  if (!t) return null;
  if (type === 'date') { const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; } return t; }
  if (type === 'number') { const n = Number(t.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : t; }
  return t;
}

const STATUS_TONE: Record<string, string> = {
  'Rematriculado': 'bg-success/15 text-success border-success/40',
  'Pendente': 'bg-warning/15 text-warning border-warning/40',
  'Não Rematriculará': 'bg-destructive/10 text-destructive border-destructive/40',
};

type Pos = { r: number; c: number };

export function RenewalGrid({ rows, columns, onEdits, onColumnsChange, onAddRow, onResolveConflict }: Props) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ colId: string; dir: 1 | -1 } | null>(null);
  const [anchor, setAnchor] = useState<Pos | null>(null);
  const [focus, setFocus] = useState<Pos | null>(null);
  const [editing, setEditing] = useState<{ pos: Pos; text: string } | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<CellEdit[][]>([]);
  const [batchCol, setBatchCol] = useState<string>('');
  const [batchVal, setBatchVal] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const resizing = useRef<{ id: string; x: number; w: number } | null>(null);

  const cols = useMemo(() => columns.filter(c => !c.hidden), [columns]);
  const hiddenCols = columns.filter(c => c.hidden);

  const view = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter(r => {
      if (q && !cols.some(c => fmtCell(cellValue(r, c), c.type).toLowerCase().includes(q))) return false;
      for (const [id, val] of Object.entries(filters)) {
        const c = columns.find(x => x.id === id); if (!c || !val) continue;
        const v = fmtCell(cellValue(r, c), c.type);
        if (val === '__vazio__' ? v !== '' : v !== val) return false;
      }
      return true;
    });
    if (sort) {
      const c = columns.find(x => x.id === sort.colId);
      if (c) list = [...list].sort((a, b) => String(cellValue(a, c) ?? '').localeCompare(String(cellValue(b, c) ?? ''), 'pt-BR', { numeric: true }) * sort.dir);
    }
    return list;
  }, [rows, cols, columns, search, filters, sort]);

  const commit = useCallback((edits: CellEdit[]) => {
    if (!edits.length) return;
    const prev = edits.map(e => { const r = rows.find(x => x.row_key === e.rowKey)!; const c = columns.find(x => x.id === e.colId)!; return { ...e, value: cellValue(r, c) ?? null }; });
    setUndo(u => [...u.slice(-49), prev]);
    onEdits(edits);
  }, [rows, columns, onEdits]);

  const doUndo = useCallback(() => {
    setUndo(u => { const last = u[u.length - 1]; if (last) onEdits(last); return u.slice(0, -1); });
  }, [onEdits]);

  const inSel = (r: number, c: number) => {
    if (!anchor || !focus) return false;
    return r >= Math.min(anchor.r, focus.r) && r <= Math.max(anchor.r, focus.r) && c >= Math.min(anchor.c, focus.c) && c <= Math.max(anchor.c, focus.c);
  };

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const onCopy = (e: ClipboardEvent) => {
      if (editing || !anchor || !focus) return;
      const r0 = Math.min(anchor.r, focus.r), r1 = Math.max(anchor.r, focus.r), c0 = Math.min(anchor.c, focus.c), c1 = Math.max(anchor.c, focus.c);
      const lines: string[] = [];
      for (let r = r0; r <= r1; r++) { const row = view[r]; if (!row) continue; const cells: string[] = []; for (let c = c0; c <= c1; c++) cells.push(fmtCell(cellValue(row, cols[c]), cols[c].type)); lines.push(cells.join('\t')); }
      e.clipboardData?.setData('text/plain', lines.join('\n')); e.preventDefault();
    };
    const onPaste = (e: ClipboardEvent) => {
      if (editing || !focus) return;
      const txt = e.clipboardData?.getData('text/plain'); if (!txt) return;
      e.preventDefault();
      const start = anchor && focus ? { r: Math.min(anchor.r, focus.r), c: Math.min(anchor.c, focus.c) } : focus;
      const grid = txt.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(l => l.split('\t'));
      const edits: CellEdit[] = [];
      grid.forEach((line, i) => line.forEach((val, j) => { const row = view[start.r + i]; const col = cols[start.c + j]; if (row && col) edits.push({ rowKey: row.row_key, colId: col.id, value: parseInput(val, col.type) }); }));
      commit(edits);
    };
    el.addEventListener('copy', onCopy); el.addEventListener('paste', onPaste);
    return () => { el.removeEventListener('copy', onCopy); el.removeEventListener('paste', onPaste); };
  }, [anchor, focus, view, cols, editing, commit]);

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); return; }
    if (editing || !focus) return;
    const move = (dr: number, dc: number) => { const p = { r: Math.max(0, Math.min(view.length - 1, focus.r + dr)), c: Math.max(0, Math.min(cols.length - 1, focus.c + dc)) }; setFocus(p); if (!e.shiftKey) setAnchor(p); e.preventDefault(); };
    if (e.key === 'ArrowDown') move(1, 0); else if (e.key === 'ArrowUp') move(-1, 0);
    else if (e.key === 'ArrowLeft') move(0, -1); else if (e.key === 'ArrowRight' || e.key === 'Tab') move(0, 1);
    else if (e.key === 'Enter') { const r = view[focus.r]; setEditing({ pos: focus, text: fmtCell(cellValue(r, cols[focus.c]), cols[focus.c].type) }); e.preventDefault(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      const edits: CellEdit[] = [];
      for (let r = 0; r < view.length; r++) for (let c = 0; c < cols.length; c++) if (inSel(r, c)) edits.push({ rowKey: view[r].row_key, colId: cols[c].id, value: null });
      commit(edits); e.preventDefault();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && cols[focus.c].type !== 'list') setEditing({ pos: focus, text: e.key });
  };

  const finishEdit = (save: boolean) => {
    if (editing && save) { const row = view[editing.pos.r]; const col = cols[editing.pos.c]; commit([{ rowKey: row.row_key, colId: col.id, value: parseInput(editing.text, col.type) }]); }
    setEditing(null); wrapRef.current?.focus();
  };

  const updateCol = (id: string, patch: Partial<RenewalColumn>) => onColumnsChange(columns.map(c => (c.id === id ? { ...c, ...patch } : c)));
  const moveCol = (id: string, dir: -1 | 1) => {
    const visible = columns.filter(c => !c.hidden); const i = visible.findIndex(c => c.id === id); const other = visible[i + dir]; if (!other) return;
    const arr = [...columns]; const a = arr.findIndex(c => c.id === id), b = arr.findIndex(c => c.id === other.id); [arr[a], arr[b]] = [arr[b], arr[a]]; onColumnsChange(arr);
  };

  useEffect(() => {
    const mv = (e: MouseEvent) => { const r = resizing.current; if (r) updateColWidth(r.id, Math.max(60, r.w + e.clientX - r.x)); };
    const up = () => { resizing.current = null; };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
  });
  const [liveWidths, setLiveWidths] = useState<Record<string, number>>({});
  const updateColWidth = (id: string, w: number) => setLiveWidths(s => ({ ...s, [id]: w }));
  useEffect(() => {
    const up = () => { if (Object.keys(liveWidths).length) { onColumnsChange(columns.map(c => (liveWidths[c.id] ? { ...c, width: liveWidths[c.id] } : c))); setLiveWidths({}); } };
    window.addEventListener('mouseup', up); return () => window.removeEventListener('mouseup', up);
  }, [liveWidths, columns, onColumnsChange]);

  const distinct = (c: RenewalColumn) => [...new Set(rows.map(r => fmtCell(cellValue(r, c), c.type)).filter(Boolean))].sort().slice(0, 200);

  const applyBatch = () => {
    const col = columns.find(c => c.id === batchCol); if (!col) return;
    commit([...checked].map(k => ({ rowKey: k, colId: col.id, value: parseInput(batchVal, col.type) })));
  };

  const addColumn = () => {
    const title = prompt('Nome da nova coluna'); if (!title) return;
    onColumnsChange([...columns, { id: newColId(), title, kind: 'manual', type: 'text', width: 160 }]);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar aluno, turma…" className="h-9 w-56 pl-8" /></div>
        <Button size="sm" variant="outline" onClick={doUndo} disabled={!undo.length}><Undo2 className="mr-1 h-4 w-4" />Desfazer</Button>
        <Button size="sm" variant="outline" onClick={onAddRow}><Plus className="mr-1 h-4 w-4" />Linha</Button>
        <Button size="sm" variant="outline" onClick={addColumn}><Plus className="mr-1 h-4 w-4" />Coluna</Button>
        {hiddenCols.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" variant="outline"><Columns3 className="mr-1 h-4 w-4" />Ocultas ({hiddenCols.length})</Button></DropdownMenuTrigger>
            <DropdownMenuContent>{hiddenCols.map(c => <DropdownMenuItem key={c.id} onClick={() => updateCol(c.id, { hidden: false })}>Mostrar "{c.title}"</DropdownMenuItem>)}</DropdownMenuContent>
          </DropdownMenu>
        )}
        {Object.values(filters).some(Boolean) && <Button size="sm" variant="ghost" onClick={() => setFilters({})}>Limpar filtros</Button>}
        <span className="ml-auto text-xs text-muted-foreground">{view.length} de {rows.length} linhas · salvamento automático</span>
      </div>
      {checked.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-2 text-sm">
          <span className="font-medium">{checked.size} selecionada(s):</span>
          <Select value={batchCol} onValueChange={v => { setBatchCol(v); setBatchVal(''); }}>
            <SelectTrigger className="h-8 w-48"><SelectValue placeholder="Coluna" /></SelectTrigger>
            <SelectContent>{cols.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
          </Select>
          {columns.find(c => c.id === batchCol)?.type === 'list'
            ? <Select value={batchVal} onValueChange={setBatchVal}><SelectTrigger className="h-8 w-56"><SelectValue placeholder="Valor" /></SelectTrigger><SelectContent>{columns.find(c => c.id === batchCol)!.options!.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
            : <Input className="h-8 w-56" value={batchVal} onChange={e => setBatchVal(e.target.value)} placeholder="Valor" />}
          <Button size="sm" onClick={applyBatch} disabled={!batchCol}>Aplicar</Button>
          <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())}>Limpar seleção</Button>
        </div>
      )}
      <div ref={wrapRef} tabIndex={0} onKeyDown={onKey} className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-card outline-none focus:ring-2 focus:ring-ring/30">
        <table className="border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="w-8 border-b border-r border-border bg-muted p-1"><input type="checkbox" checked={checked.size > 0 && checked.size === view.length} onChange={e => setChecked(e.target.checked ? new Set(view.map(r => r.row_key)) : new Set())} /></th>
              {cols.map(c => {
                const w = liveWidths[c.id] ?? c.width ?? 140;
                return (
                  <th key={c.id} style={{ width: w, minWidth: w }} className="relative border-b border-r border-border bg-primary p-0 text-left font-semibold text-primary-foreground">
                    <div className="flex items-center gap-1 px-2 py-1.5">
                      <button className="flex-1 truncate text-left" title={c.doubt ?? c.title} onClick={() => setSort(s => (s?.colId === c.id ? (s.dir === 1 ? { colId: c.id, dir: -1 } : null) : { colId: c.id, dir: 1 }))}>
                        {c.doubt && <AlertTriangle className="mr-1 inline h-3 w-3" />}{c.title}
                        {sort?.colId === c.id && (sort.dir === 1 ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />)}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded p-0.5 hover:bg-primary-foreground/20"><ChevronDown className="h-3 w-3" /></DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64">
                          <div className="px-2 py-1 text-[11px] text-muted-foreground">{c.kind === 'imported' ? 'Importada do Sponte' : c.kind === 'calculated' ? 'Calculada' : 'Preenchida pela equipe'}{c.source ? ` · ${c.source}` : ''}</div>
                          {c.doubt && <div className="px-2 pb-1 text-[11px] text-warning">{c.doubt}</div>}
                          <div className="p-1"><Select value={filters[c.id] ?? '__all__'} onValueChange={v => setFilters(f => ({ ...f, [c.id]: v === '__all__' ? '' : v }))}>
                            <SelectTrigger className="h-8"><SelectValue placeholder="Filtrar" /></SelectTrigger>
                            <SelectContent><SelectItem value="__all__">Todos</SelectItem><SelectItem value="__vazio__">(vazio)</SelectItem>{distinct(c).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                          </Select></div>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => { const t = prompt('Novo nome da coluna', c.title); if (t) updateCol(c.id, { title: t }); }}>Renomear</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => moveCol(c.id, -1)}>Mover para a esquerda</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => moveCol(c.id, 1)}>Mover para a direita</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateCol(c.id, { hidden: true })}>Ocultar</DropdownMenuItem>
                          {c.kind === 'manual' && <>
                            <DropdownMenuSeparator />
                            {(['text', 'date', 'number'] as ColType[]).map(t => <DropdownMenuItem key={t} onClick={() => updateCol(c.id, { type: t })}>Tipo: {t === 'text' ? 'texto' : t === 'date' ? 'data' : 'valor'}{c.type === t ? ' ✓' : ''}</DropdownMenuItem>)}
                            <DropdownMenuItem onClick={() => { const o = prompt('Opções da lista, separadas por ;', (c.options ?? []).join('; ')); if (o != null) updateCol(c.id, { type: 'list', options: o.split(';').map(s => s.trim()).filter(Boolean) }); }}>Tipo: lista de opções{c.type === 'list' ? ' ✓' : ''}</DropdownMenuItem>
                            {!c.field && <DropdownMenuItem className="text-destructive" onClick={() => confirm(`Excluir a coluna "${c.title}"?`) && onColumnsChange(columns.filter(x => x.id !== c.id))}>Excluir coluna</DropdownMenuItem>}
                          </>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <span className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize" onMouseDown={e => { resizing.current = { id: c.id, x: e.clientX, w }; e.preventDefault(); }} />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {view.map((row, ri) => (
              <tr key={row.row_key} className={row.imported?.fora_da_base ? 'opacity-60' : ''}>
                <td className="border-b border-r border-border bg-muted/40 p-1 text-center"><input type="checkbox" checked={checked.has(row.row_key)} onChange={e => setChecked(s => { const n = new Set(s); e.target.checked ? n.add(row.row_key) : n.delete(row.row_key); return n; })} /></td>
                {cols.map((c, ci) => {
                  const v = cellValue(row, c);
                  const ov = row.overrides?.[c.id];
                  const conflict = row.conflicts?.[c.id];
                  const sel = inSel(ri, ci);
                  const isEditing = editing?.pos.r === ri && editing.pos.c === ci;
                  const txt = fmtCell(v, c.type);
                  return (
                    <td key={c.id}
                      onMouseDown={e => { if (e.shiftKey && anchor) setFocus({ r: ri, c: ci }); else { setAnchor({ r: ri, c: ci }); setFocus({ r: ri, c: ci }); } }}
                      onMouseEnter={e => { if (e.buttons === 1 && anchor) setFocus({ r: ri, c: ci }); }}
                      onDoubleClick={() => c.type !== 'list' && setEditing({ pos: { r: ri, c: ci }, text: txt })}
                      className={`h-7 truncate border-b border-r border-border px-1.5 ${sel ? 'bg-primary/10' : ''} ${conflict ? 'ring-1 ring-inset ring-destructive' : ''} ${txt === A_CONFIRMAR ? 'text-warning font-medium' : ''} ${txt === SEM_INFO ? 'text-muted-foreground italic' : ''}`}
                      title={ov && c.kind !== 'manual' ? `Corrigido manualmente. Original: ${fmtCell(ov.original, c.type) || '(vazio)'}` : txt}>
                      {isEditing ? (
                        <input autoFocus className="h-6 w-full bg-background px-1 outline-none" value={editing.text}
                          onChange={e => setEditing({ ...editing, text: e.target.value })}
                          onBlur={() => finishEdit(true)}
                          onKeyDown={e => { if (e.key === 'Enter') finishEdit(true); if (e.key === 'Escape') finishEdit(false); e.stopPropagation(); }} />
                      ) : c.type === 'list' && c.options?.length && c.options.length <= 3 ? (
                        <div className="flex gap-0.5">
                          {c.options.map(o => (
                            <button key={o} title={o} onClick={() => commit([{ rowKey: row.row_key, colId: c.id, value: v === o ? null : o }])}
                              className={`truncate rounded border px-1 text-[10px] leading-4 ${v === o ? STATUS_TONE[o] ?? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                              {v === o ? '✓ ' : ''}{o.split(' ')[0]}
                            </button>
                          ))}
                        </div>
                      ) : c.type === 'list' ? (
                        <select className="h-6 w-full truncate bg-transparent outline-none" value={v ?? ''} onChange={e => commit([{ rowKey: row.row_key, colId: c.id, value: e.target.value || null }])}>
                          <option value="">—</option>
                          {(c.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <span className="flex items-center gap-1">
                          {ov && c.kind !== 'manual' && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                          <span className="truncate">{txt}</span>
                          {conflict && (
                            <DropdownMenu>
                              <DropdownMenuTrigger><Badge variant="destructive" className="h-4 px-1 text-[9px]">conflito</Badge></DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <div className="px-2 py-1 text-xs">Nova importação trouxe: <b>{fmtCell(conflict.imported, c.type) || '(vazio)'}</b></div>
                                <DropdownMenuItem onClick={() => onResolveConflict(row.row_key, c.id, 'manual')}>Manter correção ({fmtCell(conflict.manual, c.type)})</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onResolveConflict(row.row_key, c.id, 'imported')}>Usar valor importado</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">Dica: clique e arraste ou use Shift para selecionar várias células; Ctrl+C / Ctrl+V copia e cola (inclusive do Excel); Delete limpa; Ctrl+Z desfaz. Ponto laranja = valor corrigido à mão (passe o mouse para ver o original).</p>
    </div>
  );
}

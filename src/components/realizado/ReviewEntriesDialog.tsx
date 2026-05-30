import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, HelpCircle } from 'lucide-react';

interface AffectedEntry {
  id: string;
  data: string;
  valor: number;
  descricao: string;
  conta_nome: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: AffectedEntry[];
  originalCategoryName: string;
  newCategoryName: string;
  contaGrupoMap: Record<string, string>;
  onConfirm: (selectedIds: string[], saveRule: boolean) => Promise<void>;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function ReviewEntriesDialog({
  open,
  onOpenChange,
  entries,
  originalCategoryName,
  newCategoryName,
  contaGrupoMap,
  onConfirm,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Filter entries to know which ones match the description. All of them do, but let's be sure.
  const originalDescription = entries[0]?.descricao || '';

  // Get default selection set (entries with same description AND same original category)
  const defaultSelectedSet = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => {
      if (e.conta_nome === originalCategoryName) {
        set.add(e.id);
      }
    });
    return set;
  }, [entries, originalCategoryName]);

  // Reset selection when opening dialog
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(defaultSelectedSet));
    }
  }, [open, defaultSelectedSet]);

  // Master checkbox states
  const isAllSelected = entries.length > 0 && selectedIds.size === entries.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < entries.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(entries.map(e => e.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedIds(next);
  };

  // Compare current selection to default selection to check if modified
  const isSelectionModified = useMemo(() => {
    if (selectedIds.size !== defaultSelectedSet.size) return true;
    for (const id of selectedIds) {
      if (!defaultSelectedSet.has(id)) return true;
    }
    return false;
  }, [selectedIds, defaultSelectedSet]);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const selectedList = Array.from(selectedIds);
      // Save rule if selection was NOT modified (user accepted the smart suggestion)
      const saveRule = !isSelectionModified;
      await onConfirm(selectedList, saveRule);
      onOpenChange(false);
    } catch {
      // Error handled by parent mutation
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-6 rounded-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg font-display font-bold text-foreground">
            Revisar Lançamentos Afetados
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Os lançamentos abaixo possuem a descrição <strong>"{originalDescription}"</strong>. Selecione quais deseja reclassificar para a nova categoria <strong>"{newCategoryName}"</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Informational Banner */}
        <div className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 my-2 ${
          isSelectionModified
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
            : 'bg-primary/5 border-primary/20 text-primary-foreground dark:text-primary'
        }`}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            {!isSelectionModified ? (
              <p>
                <strong>Sugestão Inteligente Ativa:</strong> Por padrão, pré-selecionamos apenas os lançamentos que compartilham da mesma categoria filha original (<em>"{originalCategoryName}"</em>). Se você confirmar agora, uma <strong>regra de categorização automática</strong> será criada para futuros envios.
              </p>
            ) : (
              <p>
                <strong>Seleção Modificada Manualmente:</strong> Como você alterou a lista padrão de lançamentos afetados, **nenhuma regra de categorização automática** será salva para futuros uploads. Apenas os lançamentos marcados abaixo serão reclassificados desta vez.
              </p>
            )}
          </div>
        </div>

        {/* Scrollable Table Area */}
        <div className="flex-1 overflow-y-auto border border-border/50 rounded-xl my-2 max-h-[40vh]">
          <Table>
            <TableHeader className="bg-muted/30 sticky top-0 z-10">
              <TableRow className="border-b border-border/40">
                <TableHead className="w-[50px] text-center py-2.5">
                  <Checkbox
                    checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                    onCheckedChange={handleSelectAll}
                    className="rounded"
                  />
                </TableHead>
                <TableHead className="text-left py-2.5 text-xs font-semibold">Data</TableHead>
                <TableHead className="text-left py-2.5 text-xs font-semibold">Descrição</TableHead>
                <TableHead className="text-left py-2.5 text-xs font-semibold">Categoria Mãe</TableHead>
                <TableHead className="text-left py-2.5 text-xs font-semibold">Categoria Filha</TableHead>
                <TableHead className="text-right py-2.5 text-xs font-semibold pr-4">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(e => {
                const isChecked = selectedIds.has(e.id);
                const isSugerido = e.conta_nome === originalCategoryName;
                const grupo = contaGrupoMap[e.conta_nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()] || 'Outros';

                return (
                  <TableRow
                    key={e.id}
                    className={`border-b border-border/20 transition-colors hover:bg-muted/10 ${
                      isChecked ? 'bg-primary/5 hover:bg-primary/10' : ''
                    }`}
                  >
                    <TableCell className="text-center py-2.5">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => handleSelectOne(e.id, !!checked)}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell className="py-2.5 text-xs font-medium whitespace-nowrap">
                      {formatDate(e.data)}
                    </TableCell>
                    <TableCell className="py-2.5 text-xs font-medium text-foreground max-w-[150px] truncate" title={e.descricao}>
                      {e.descricao}
                    </TableCell>
                    <TableCell className="py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {grupo}
                    </TableCell>
                    <TableCell className="py-2.5 text-xs font-medium whitespace-nowrap">
                      <span className={isSugerido ? 'text-primary' : 'text-foreground'}>
                        {e.conta_nome}
                      </span>
                      {isSugerido && (
                        <span className="text-[9px] bg-primary/10 text-primary px-1 py-0.5 rounded ml-1.5 font-bold uppercase tracking-wider">
                          Sugerido
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5 text-xs font-semibold text-right pr-4 tabular-nums text-foreground">
                      {formatCurrency(e.valor)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="pt-4 border-t border-border/50 gap-2 sm:gap-0 mt-2">
          <Button
            variant="outline"
            className="rounded-xl text-xs font-medium"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            className="rounded-xl text-xs font-medium px-5"
            onClick={handleConfirm}
            disabled={selectedIds.size === 0 || saving}
          >
            {saving ? 'Salvando...' : `Confirmar (${selectedIds.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

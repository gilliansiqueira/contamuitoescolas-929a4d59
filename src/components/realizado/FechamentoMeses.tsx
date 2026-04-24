import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Lock, Unlock, AlertTriangle, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { usePeriodClosures, useCloseMonths, useReopenMonth, type PeriodClosure } from '@/hooks/usePeriodClosures';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';

interface Props {
  schoolId: string;
}

function formatMonth(m: string): string {
  const [y, mm] = m.split('-');
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${names[parseInt(mm) - 1]}/${y}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function FechamentoMeses({ schoolId }: Props) {
  const { isAdmin } = useAuth();
  const { data: closures = [], isLoading } = usePeriodClosures(schoolId);
  const closeMutation = useCloseMonths(schoolId);
  const reopenMutation = useReopenMonth(schoolId);

  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [reopenTarget, setReopenTarget] = useState<PeriodClosure | null>(null);
  const [reopenReason, setReopenReason] = useState('');

  // Buscar todos os meses com dados (realized_entries) para popular a lista
  const { data: monthsWithData = [] } = useQuery({
    queryKey: ['available_months_realized', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('realized_entries')
        .select('data')
        .eq('school_id', schoolId);
      if (error) throw error;
      const set = new Set<string>();
      (data || []).forEach(r => { if (r.data) set.add(r.data.slice(0, 7)); });
      return Array.from(set).sort().reverse();
    },
    enabled: !!schoolId,
  });

  const closedMap = useMemo(() => {
    const m = new Map<string, PeriodClosure>();
    closures.filter(c => c.status === 'closed').forEach(c => m.set(c.month, c));
    return m;
  }, [closures]);

  // Lista combinada: meses com dados + meses já fechados (mesmo sem dados)
  const allMonths = useMemo(() => {
    const set = new Set<string>([...monthsWithData, ...Array.from(closedMap.keys())]);
    return Array.from(set).sort().reverse();
  }, [monthsWithData, closedMap]);

  const reopenedHistory = useMemo(() => closures.filter(c => c.status === 'reopened'), [closures]);

  const toggleSelect = (month: string) => {
    if (closedMap.has(month)) return;
    setSelectedMonths(prev => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month); else next.add(month);
      return next;
    });
  };

  const handleCloseSelected = async () => {
    const months = Array.from(selectedMonths);
    if (months.length === 0) return;
    try {
      await closeMutation.mutateAsync(months);
      toast.success(`${months.length} mês(es) fechado(s) com sucesso.`);
      setSelectedMonths(new Set());
      setConfirmCloseOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao fechar meses.');
    }
  };

  const handleReopen = async () => {
    if (!reopenTarget) return;
    try {
      await reopenMutation.mutateAsync({
        closureId: reopenTarget.id,
        month: reopenTarget.month,
        reason: reopenReason.trim(),
      });
      toast.success(`Mês ${formatMonth(reopenTarget.month)} reaberto.`);
      setReopenTarget(null);
      setReopenReason('');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao reabrir mês.');
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              Fechamento de Períodos
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Meses fechados ficam bloqueados para edição, exclusão e reclassificação no Relatório Realizado.
            </p>
          </div>
          {selectedMonths.size > 0 && (
            <Button size="sm" className="rounded-xl" onClick={() => setConfirmCloseOpen(true)}>
              <Lock className="w-4 h-4 mr-1.5" />
              Fechar {selectedMonths.size} mês(es)
            </Button>
          )}
        </div>

        {allMonths.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhum mês com dados ou fechamento ainda.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {allMonths.map(month => {
              const closure = closedMap.get(month);
              const isClosed = !!closure;
              const isSelected = selectedMonths.has(month);
              return (
                <motion.div
                  key={month}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl border p-3 transition-colors ${
                    isClosed
                      ? 'bg-muted/40 border-muted'
                      : isSelected
                      ? 'border-primary bg-primary/5'
                      : 'bg-background hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {!isClosed && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(month)}
                          aria-label={`Selecionar ${month}`}
                        />
                      )}
                      <span className="font-semibold text-sm">{formatMonth(month)}</span>
                    </div>
                    {isClosed && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Lock className="w-3 h-3" /> Fechado
                      </Badge>
                    )}
                  </div>
                  {isClosed && (
                    <>
                      <p className="text-xs text-muted-foreground">
                        em {formatDateTime(closure.closed_at)}
                      </p>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-2 h-7 px-2 text-xs rounded-lg"
                          onClick={() => setReopenTarget(closure)}
                        >
                          <Unlock className="w-3 h-3 mr-1" /> Reabrir
                        </Button>
                      )}
                    </>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {reopenedHistory.length > 0 && (
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-muted-foreground" />
            Histórico de Reaberturas
          </h3>
          <div className="space-y-2">
            {reopenedHistory.map(c => (
              <div key={c.id} className="text-xs flex items-start justify-between gap-3 py-2 border-b last:border-0">
                <div>
                  <span className="font-medium">{formatMonth(c.month)}</span>
                  {c.reopen_reason && <span className="text-muted-foreground"> — {c.reopen_reason}</span>}
                </div>
                <span className="text-muted-foreground whitespace-nowrap">
                  {c.reopened_at ? formatDateTime(c.reopened_at) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmar fechamento */}
      <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirmar fechamento
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a fechar {selectedMonths.size} mês(es):{' '}
              <strong>{Array.from(selectedMonths).sort().map(formatMonth).join(', ')}</strong>.
              <br /><br />
              Após o fechamento, lançamentos, faturamento, KPIs e recebimentos desses meses ficarão bloqueados
              para edição. Apenas administradores poderão reabrir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl" onClick={handleCloseSelected} disabled={closeMutation.isPending}>
              Fechar período
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reabrir */}
      <AlertDialog open={!!reopenTarget} onOpenChange={o => { if (!o) { setReopenTarget(null); setReopenReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Unlock className="w-5 h-5 text-primary" />
              Reabrir {reopenTarget && formatMonth(reopenTarget.month)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo da reabertura (será registrado em auditoria).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={reopenReason}
            onChange={e => setReopenReason(e.target.value)}
            placeholder="Ex.: Correção de lançamento errado"
            className="rounded-xl"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl" onClick={handleReopen} disabled={reopenMutation.isPending}>
              Reabrir mês
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

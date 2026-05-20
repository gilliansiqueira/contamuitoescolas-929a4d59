import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { applyTemplateToSchool, fetchTemplates, fetchSchoolTemplateId } from '@/lib/financialModels';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Building2, LayoutTemplate, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props { schoolId: string; onChanged?: () => void; }

export function EmpresaModeloConfig({ schoolId, onChanged }: Props) {
  const qc = useQueryClient();
  const { data: templates = [] } = useQuery({
    queryKey: ['financial_model_templates'],
    queryFn: fetchTemplates,
  });
  const { data: currentTemplateId } = useQuery({
    queryKey: ['school_template', schoolId],
    queryFn: () => fetchSchoolTemplateId(schoolId),
    enabled: !!schoolId,
  });

  const [selected, setSelected] = useState<string>('');
  const [confirm, setConfirm] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (currentTemplateId) setSelected(currentTemplateId);
  }, [currentTemplateId]);

  const apply = async () => {
    if (!selected) return;
    setApplying(true);
    try {
      await applyTemplateToSchool(schoolId, selected);
      toast.success('Modelo aplicado. Tipos copiados para Classificação de Tipos e Histórico Financeiro.');
      // Invalida tudo que depende de classificações / tipos / histórico
      qc.invalidateQueries({ queryKey: ['school_template', schoolId] });
      qc.invalidateQueries({ queryKey: ['typeClassifications'] });
      qc.invalidateQueries({ queryKey: ['fluxoTipos'] });
      qc.invalidateQueries({ queryKey: ['historicalMonthly'] });
      qc.invalidateQueries({ queryKey: ['availableMonths'] });
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao aplicar modelo');
    } finally {
      setApplying(false);
      setConfirm(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="glass-card rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold text-foreground text-sm">Modelo Financeiro da Empresa</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Escolha um modelo e clique em <strong>Aplicar</strong>. Os tipos serão copiados para esta empresa de forma independente — você pode editar, excluir ou adicionar tipos sem afetar o modelo original.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map(t => {
            const isCurrent = currentTemplateId === t.id;
            const isSelected = selected === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <LayoutTemplate className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">{t.name}</span>
                  </div>
                  {isCurrent && <CheckCircle2 className="w-4 h-4 text-success" />}
                </div>
                {t.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={() => setConfirm(true)} disabled={!selected || applying}>
            {applying ? 'Aplicando…' : 'Aplicar modelo'}
          </Button>
        </div>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar modelo à empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Os tipos do modelo serão copiados para esta empresa. Tipos já existentes serão atualizados conforme o modelo. Nenhum tipo será excluído. Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={apply}>Aplicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

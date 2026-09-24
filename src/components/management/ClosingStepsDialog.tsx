import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CheckCircle2, Circle, ListChecks, MinusCircle, Plus, Trash2 } from 'lucide-react';
import {
  useClosingStepTemplates,
  useDeleteSchoolStepOverride,
  useEnsureMonthlyChecklist,
  useMonthlyChecklist,
  useSaveClosingStepTemplate,
  useSaveSchoolStepOverride,
  useSchoolStepOverrides,
  useSetChecklistStatus,
} from '@/hooks/useClosingSteps';

function slugify(label: string) {
  return label
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || `etapa_${Date.now()}`;
}

// ---------- Modelo padrão (somente proprietária) ----------

export function ClosingStepTemplatesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: templates = [], isLoading } = useClosingStepTemplates(open);
  const saveTemplate = useSaveClosingStepTemplate();
  const [newLabel, setNewLabel] = useState('');

  const addTemplate = () => {
    const label = newLabel.trim().replace(/\s+/g, ' ');
    if (!label) { toast.error('Digite o nome da etapa.'); return; }
    const nextOrder = templates.reduce((max, t) => Math.max(max, t.sort_order), 0) + 1;
    saveTemplate.mutate(
      { step_key: slugify(label), label, sort_order: nextOrder, active: true },
      { onSuccess: () => { setNewLabel(''); toast.success('Etapa adicionada ao modelo padrão.'); }, onError: error => toast.error(error instanceof Error ? error.message : 'Não foi possível salvar.') },
    );
  };

  const move = (index: number, direction: -1 | 1) => {
    const ordered = [...templates].sort((a, b) => a.sort_order - b.sort_order);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const current = ordered[index];
    const other = ordered[target];
    saveTemplate.mutate({ ...current, sort_order: other.sort_order });
    saveTemplate.mutate({ ...other, sort_order: current.sort_order });
  };

  const ordered = useMemo(() => [...templates].sort((a, b) => a.sort_order - b.sort_order), [templates]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ListChecks className="h-4 w-4" />Etapas padrão de fechamento</DialogTitle>
          <DialogDescription>Estas etapas valem para todas as empresas e se repetem todo mês. Cada empresa pode desativar ou acrescentar etapas na própria configuração.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
          {isLoading && <p className="py-6 text-center text-xs text-muted-foreground">Carregando…</p>}
          {!isLoading && ordered.length === 0 && <p className="rounded-md bg-muted/30 p-4 text-center text-xs text-muted-foreground">Nenhuma etapa cadastrada ainda. Adicione a primeira abaixo.</p>}
          {ordered.map((template, index) => (
            <div key={template.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2">
              <div className="flex flex-col">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0 || saveTemplate.isPending} className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Subir etapa">▲</button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === ordered.length - 1 || saveTemplate.isPending} className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Descer etapa">▼</button>
              </div>
              <Input
                defaultValue={template.label}
                className="h-8 flex-1 text-xs"
                onBlur={event => {
                  const label = event.target.value.trim();
                  if (label && label !== template.label) {
                    saveTemplate.mutate({ ...template, label }, { onError: error => toast.error(error instanceof Error ? error.message : 'Não foi possível salvar.') });
                  }
                }}
              />
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={template.active}
                  onCheckedChange={active => saveTemplate.mutate({ ...template, active }, { onError: error => toast.error(error instanceof Error ? error.message : 'Não foi possível salvar.') })}
                  aria-label={template.active ? 'Desativar etapa' : 'Ativar etapa'}
                />
                <span className="w-14 text-[10px] text-muted-foreground">{template.active ? 'Ativa' : 'Inativa'}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 border-t pt-3">
          <Input value={newLabel} onChange={event => setNewLabel(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addTemplate(); }} placeholder="Nova etapa (ex.: Conciliar extrato)" className="h-9 text-xs" />
          <Button size="sm" className="h-9 gap-1.5" onClick={addTemplate} disabled={saveTemplate.isPending}><Plus className="h-3.5 w-3.5" />Adicionar</Button>
        </div>
        <p className="text-[10px] text-muted-foreground">As mudanças valem para os meses gerados a partir de agora; meses já em andamento não são alterados.</p>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Configuração por empresa + checklist do mês ----------

interface SchoolStepsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string | null;
  schoolName: string;
  month: string;
  canEditTemplates: boolean;
}

export function SchoolStepsDialog({ open, onOpenChange, schoolId, schoolName, month, canEditTemplates }: SchoolStepsDialogProps) {
  const { data: templates = [] } = useClosingStepTemplates(open);
  const { data: overrides = [] } = useSchoolStepOverrides(open ? schoolId : null);
  const { data: checklist = [], isLoading: checklistLoading } = useMonthlyChecklist(open ? schoolId : null, month);
  const saveOverride = useSaveSchoolStepOverride(schoolId);
  const deleteOverride = useDeleteSchoolStepOverride(schoolId);
  const setStatus = useSetChecklistStatus(schoolId, month);
  const ensure = useEnsureMonthlyChecklist();
  const [extraLabel, setExtraLabel] = useState('');

  useEffect(() => {
    if (open && schoolId && templates.length > 0) {
      ensure.mutate({ schoolId, month });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schoolId, month, templates.length]);

  const overrideByTemplate = useMemo(() => new Map(overrides.filter(o => o.template_id).map(o => [o.template_id as string, o])), [overrides]);
  const extraSteps = useMemo(() => overrides.filter(o => !o.template_id && !o.disabled), [overrides]);

  const toggleTemplate = (templateId: string, stepKey: string, disabled: boolean) => {
    saveOverride.mutate(
      { template_id: templateId, step_key: stepKey, label: null, disabled, sort_order: 0 },
      { onError: error => toast.error(error instanceof Error ? error.message : 'Não foi possível salvar.') },
    );
  };

  const renameTemplate = (templateId: string, stepKey: string, label: string) => {
    const trimmed = label.trim();
    saveOverride.mutate(
      { template_id: templateId, step_key: stepKey, label: trimmed || null, disabled: overrideByTemplate.get(templateId)?.disabled ?? false, sort_order: 0 },
      { onError: error => toast.error(error instanceof Error ? error.message : 'Não foi possível salvar.') },
    );
  };

  const addExtra = () => {
    const label = extraLabel.trim().replace(/\s+/g, ' ');
    if (!label) { toast.error('Digite o nome da etapa.'); return; }
    saveOverride.mutate(
      { template_id: null, step_key: `extra_${slugify(label)}`, label, disabled: false, sort_order: extraSteps.length + 1 },
      { onSuccess: () => { setExtraLabel(''); toast.success('Etapa extra adicionada.'); }, onError: error => toast.error(error instanceof Error ? error.message : 'Não foi possível salvar.') },
    );
  };

  const activeTemplates = templates.filter(t => t.active).sort((a, b) => a.sort_order - b.sort_order);
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ListChecks className="h-4 w-4" />Etapas de fechamento — {schoolName}</DialogTitle>
          <DialogDescription>Ajuste as etapas desta empresa e acompanhe o checklist de {monthLabel}.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Etapas desta empresa</h3>
            <div className="space-y-1.5">
              {activeTemplates.map(template => {
                const override = overrideByTemplate.get(template.id);
                const disabled = override?.disabled ?? false;
                return (
                  <div key={template.id} className={`flex items-center gap-2 rounded-md border border-border px-2.5 py-2 ${disabled ? 'bg-muted/30 opacity-60' : 'bg-card'}`}>
                    <Input
                      defaultValue={override?.label ?? template.label}
                      disabled={disabled}
                      className="h-8 flex-1 text-xs"
                      onBlur={event => { if (event.target.value.trim() !== (override?.label ?? template.label)) renameTemplate(template.id, template.step_key, event.target.value); }}
                    />
                    <div className="flex items-center gap-1.5">
                      <Switch checked={!disabled} onCheckedChange={enabled => toggleTemplate(template.id, template.step_key, !enabled)} aria-label={disabled ? 'Ativar etapa nesta empresa' : 'Desativar etapa nesta empresa'} />
                      <span className="w-14 text-[10px] text-muted-foreground">{disabled ? 'Desativada' : 'Ativa'}</span>
                    </div>
                  </div>
                );
              })}
              {extraSteps.map(extra => (
                <div key={extra.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2">
                  <span className="flex-1 truncate text-xs">{extra.label}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">Extra</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteOverride.mutate(extra.id)} aria-label="Remover etapa extra"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
              {activeTemplates.length === 0 && extraSteps.length === 0 && (
                <p className="rounded-md bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                  Nenhuma etapa disponível. {canEditTemplates ? 'Cadastre o modelo padrão no botão "Etapas padrão" da Central.' : 'Peça à proprietária para cadastrar o modelo padrão.'}
                </p>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <Input value={extraLabel} onChange={event => setExtraLabel(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addExtra(); }} placeholder="Etapa extra só desta empresa" className="h-9 text-xs" />
              <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={addExtra} disabled={saveOverride.isPending}><Plus className="h-3.5 w-3.5" />Adicionar</Button>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Checklist de {monthLabel}</h3>
            {checklistLoading && <p className="py-4 text-center text-xs text-muted-foreground">Carregando…</p>}
            {!checklistLoading && checklist.length === 0 && (
              <p className="rounded-md bg-muted/30 p-4 text-center text-xs text-muted-foreground">Nenhuma etapa gerada para este mês. Ajuste as etapas acima e reabra esta janela.</p>
            )}
            <div className="space-y-1.5">
              {checklist.map(item => (
                <div key={item.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2">
                  {item.status === 'completed'
                    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    : item.status === 'not_applicable'
                      ? <MinusCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                      : <Circle className="h-4 w-4 shrink-0 text-warning" />}
                  <span className={`flex-1 text-xs ${item.status === 'completed' ? 'text-muted-foreground line-through' : ''}`}>{item.label}</span>
                  <Select value={item.status} onValueChange={value => setStatus.mutate({ id: item.id, status: value as 'open' | 'completed' | 'not_applicable' }, { onError: error => toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar.') })}>
                    <SelectTrigger className="h-7 w-[130px] text-[11px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Pendente</SelectItem>
                      <SelectItem value="completed">Concluída</SelectItem>
                      <SelectItem value="not_applicable">Não se aplica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useExpenseDetailConfig } from '@/hooks/useExpenseDetail';

export function DetalhamentoConfig({ schoolId }: { schoolId: string }) {
  const { enabled, label, save } = useExpenseDetailConfig(schoolId);
  const [nome, setNome] = useState(label);

  useEffect(() => { setNome(label); }, [label]);

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5 space-y-4">
        <div>
          <h4 className="text-sm font-semibold">Detalhamento de Despesas</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Área livre para organizar gastos por obras, unidades, projetos — sem ligação com o plano de contas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={enabled}
            onCheckedChange={v => save.mutate({ expense_detail_enabled: v })}
          />
          <span className="text-sm">{enabled ? 'Ativado para esta empresa' : 'Desativado'}</span>
        </div>

        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome da aba</label>
            <Input
              className="rounded-xl"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex.: Obras, Unidades, Projetos"
            />
          </div>
          <Button
            className="rounded-xl"
            onClick={() => {
              if (!nome.trim()) { toast.error('Informe um nome'); return; }
              save.mutate({ expense_detail_label: nome.trim() }, { onSuccess: () => toast.success('Nome salvo') });
            }}
          >
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

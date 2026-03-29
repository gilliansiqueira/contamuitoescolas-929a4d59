import { useState } from 'react';
import { getSaldoInicial, getSaldoInicialData, setSaldoInicial } from '@/lib/storage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Wallet, Check, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

interface SaldoInicialConfigProps {
  schoolId: string;
  onChanged: () => void;
}

export function SaldoInicialConfig({ schoolId, onChanged }: SaldoInicialConfigProps) {
  const [valor, setValor] = useState(() => getSaldoInicial(schoolId));
  const [dataBase, setDataBase] = useState(() => getSaldoInicialData(schoolId) || '');
  const [saved, setSaved] = useState(true);

  const handleSave = () => {
    if (dataBase && !/^\d{4}-\d{2}-\d{2}$/.test(dataBase)) {
      toast.error('Data inválida. Use o formato AAAA-MM-DD');
      return;
    }
    setSaldoInicial(schoolId, valor, dataBase || undefined);
    setSaved(true);
    onChanged();
    toast.success('Saldo inicial atualizado');
  };

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Wallet className="w-5 h-5 text-primary" />
        <h3 className="font-display font-semibold text-foreground text-sm">Saldo Inicial</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Defina o saldo inicial e a data base. O fluxo de caixa será calculado a partir desta data.
        Transações anteriores à data base serão ignoradas.
      </p>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground w-20">Valor:</span>
          <span className="text-sm font-medium text-muted-foreground">R$</span>
          <Input
            type="number"
            step="0.01"
            value={valor}
            onChange={e => { setValor(parseFloat(e.target.value) || 0); setSaved(false); }}
            className="w-40 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground w-20">Data base:</span>
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <Input
            type="date"
            value={dataBase}
            onChange={e => { setDataBase(e.target.value); setSaved(false); }}
            className="w-44 h-9 text-sm"
          />
        </div>
        <Button size="sm" onClick={handleSave} disabled={saved} variant={saved ? 'outline' : 'default'}>
          <Check className="w-4 h-4 mr-1" />
          {saved ? 'Salvo' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { getSaldoInicial, setSaldoInicial } from '@/lib/storage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Wallet, Check } from 'lucide-react';
import { toast } from 'sonner';

interface SaldoInicialConfigProps {
  schoolId: string;
  onChanged: () => void;
}

export function SaldoInicialConfig({ schoolId, onChanged }: SaldoInicialConfigProps) {
  const [valor, setValor] = useState(() => getSaldoInicial(schoolId));
  const [saved, setSaved] = useState(true);

  const handleSave = () => {
    setSaldoInicial(schoolId, valor);
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
      <p className="text-xs text-muted-foreground mb-3">
        Defina o saldo inicial da escola. Este valor será o ponto de partida de todo o fluxo de caixa.
      </p>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">R$</span>
        <Input
          type="number"
          step="0.01"
          value={valor}
          onChange={e => { setValor(parseFloat(e.target.value) || 0); setSaved(false); }}
          className="w-40 h-9 text-sm"
        />
        <Button size="sm" onClick={handleSave} disabled={saved} variant={saved ? 'outline' : 'default'}>
          <Check className="w-4 h-4 mr-1" />
          {saved ? 'Salvo' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}

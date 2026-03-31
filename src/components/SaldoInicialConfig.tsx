import { useState } from 'react';
import { useSchool, useUpdateSchool } from '@/hooks/useFinancialData';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Wallet, Check, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

interface SaldoInicialConfigProps {
  schoolId: string;
  onChanged: () => void;
}

/** Parse Brazilian number format: 1.500,50 or 1500,50 or 1500.50 */
function parseBrazilianNumber(raw: string): number {
  if (!raw || !raw.trim()) return 0;
  let s = raw.trim();
  // If has both dot and comma, the last one is the decimal separator
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastComma > lastDot) {
    // Brazilian format: 1.500,50
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma && lastComma >= 0) {
    // Weird but handle: 1,500.50
    s = s.replace(/,/g, '');
  }
  // Otherwise just parse as-is
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function SaldoInicialConfig({ schoolId, onChanged }: SaldoInicialConfigProps) {
  const { data: school } = useSchool(schoolId);
  const updateSchool = useUpdateSchool();
  const [valorStr, setValorStr] = useState(() => {
    const v = school?.saldoInicial ?? 0;
    return v === 0 ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  });
  const [dataBase, setDataBase] = useState(() => school?.saldoInicialData || '');
  const [saved, setSaved] = useState(true);

  // Sync when school data loads
  const currentSaldo = school?.saldoInicial ?? 0;
  const currentData = school?.saldoInicialData || '';

  const handleSave = async () => {
    if (dataBase && !/^\d{4}-\d{2}-\d{2}$/.test(dataBase)) {
      toast.error('Data inválida. Use o formato AAAA-MM-DD');
      return;
    }
    const valor = parseBrazilianNumber(valorStr);
    try {
      await updateSchool.mutateAsync({
        id: schoolId,
        saldo_inicial: valor,
        saldo_inicial_data: dataBase || null,
      });
      setSaved(true);
      onChanged();
      toast.success('Saldo inicial atualizado');
    } catch {
      toast.error('Erro ao salvar saldo inicial');
    }
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
        <br />
        <strong>Aceita formatos:</strong> 1500,50 • 1.500,50 • 1500.50
      </p>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground w-20">Valor:</span>
          <span className="text-sm font-medium text-muted-foreground">R$</span>
          <Input
            type="text"
            inputMode="decimal"
            value={valorStr}
            onChange={e => { setValorStr(e.target.value); setSaved(false); }}
            placeholder="1.500,50"
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
        <Button size="sm" onClick={handleSave} disabled={saved || updateSchool.isPending} variant={saved ? 'outline' : 'default'}>
          <Check className="w-4 h-4 mr-1" />
          {updateSchool.isPending ? 'Salvando...' : saved ? 'Salvo' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}

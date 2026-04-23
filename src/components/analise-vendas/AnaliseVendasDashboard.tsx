import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings2 } from 'lucide-react';
import { CadastrosConfig } from './CadastrosConfig';
import { AnaliseVendasCards } from './AnaliseVendasCards';
import { PedidosTable } from './PedidosTable';
import {
  useSAChannels, useSAOrderItems, useSAOrders, useSAPaymentMethods,
} from './useAnaliseVendasData';

interface Props {
  schoolId: string;
}

export function AnaliseVendasDashboard({ schoolId }: Props) {
  const [showConfig, setShowConfig] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [channel, setChannel] = useState('all');
  const [method, setMethod] = useState('all');

  const { data: orders = [] } = useSAOrders(schoolId);
  const { data: items = [] } = useSAOrderItems(schoolId);
  const { data: channels = [] } = useSAChannels(schoolId);
  const { data: methods = [] } = useSAPaymentMethods(schoolId);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (dateFrom && o.order_date < dateFrom) return false;
      if (dateTo && o.order_date > dateTo) return false;
      if (channel !== 'all' && o.channel_id !== channel) return false;
      if (method !== 'all' && o.payment_method_id !== method) return false;
      return true;
    });
  }, [orders, dateFrom, dateTo, channel, method]);

  const filteredOrderIds = useMemo(() => new Set(filteredOrders.map(o => o.id)), [filteredOrders]);
  const filteredItems = useMemo(() => items.filter(i => filteredOrderIds.has(i.order_id)), [items, filteredOrderIds]);

  if (showConfig) {
    return <CadastrosConfig schoolId={schoolId} onBack={() => setShowConfig(false)} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-display font-semibold tracking-tight">Análise de Vendas</h2>
          <p className="text-muted-foreground text-sm">Painel inteligente de faturamento, lucro e comportamento.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowConfig(true)}>
          <Settings2 className="w-4 h-4 mr-1.5" /> Cadastros
        </Button>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl border bg-card">
        <div>
          <Label className="text-xs">Data inicial</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">Data final</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">Canal</Label>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os canais</SelectItem>
              {channels.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Forma de pagamento</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as formas</SelectItem>
              {methods.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <AnaliseVendasCards
        schoolId={schoolId}
        orders={filteredOrders}
        items={filteredItems}
        channels={channels}
        methods={methods}
      />

      <PedidosTable
        schoolId={schoolId}
        filterDateFrom={dateFrom}
        filterDateTo={dateTo}
        filterChannel={channel}
        filterMethod={method}
      />
    </div>
  );
}

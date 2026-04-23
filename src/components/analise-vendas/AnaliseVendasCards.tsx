import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  DollarSign, TrendingUp, ShoppingCart, Receipt, Crown, Star,
  Percent, BadgeDollarSign, CreditCard, Radio, Settings2,
} from 'lucide-react';
import type { SAChannel, SACardVisibility, SAOrder, SAOrderItem, SAPaymentMethod, SAProduct } from './types';
import { DEFAULT_CARD_VISIBILITY } from './types';
import { useSAProducts } from './useAnaliseVendasData';

interface Props {
  schoolId: string;
  orders: SAOrder[];
  items: SAOrderItem[];
  channels: SAChannel[];
  methods: SAPaymentMethod[];
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CARD_LABELS: Record<keyof SACardVisibility, string> = {
  faturamento_bruto: 'Faturamento bruto',
  faturamento_liquido: 'Faturamento líquido',
  qtd_pedidos: 'Quantidade de pedidos',
  ticket_medio: 'Ticket médio',
  produto_mais_vendido: 'Produto mais vendido',
  produto_mais_lucrativo: 'Produto mais lucrativo',
  margem_bruta: 'Margem bruta (%)',
  lucro_bruto: 'Lucro bruto',
  forma_mais_usada: 'Forma de pagamento mais usada',
  canal_top: 'Canal com mais vendas',
};

function loadVisibility(schoolId: string): SACardVisibility {
  try {
    const raw = localStorage.getItem(`sa_card_visibility_${schoolId}`);
    if (raw) return { ...DEFAULT_CARD_VISIBILITY, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_CARD_VISIBILITY;
}

function saveVisibility(schoolId: string, v: SACardVisibility) {
  try { localStorage.setItem(`sa_card_visibility_${schoolId}`, JSON.stringify(v)); } catch {}
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
  iconUrl?: string | null;
}
function KpiCard({ icon, label, value, hint, accent = 'text-primary', iconUrl }: KpiCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          {iconUrl ? (
            <div className="p-1.5 rounded-lg bg-primary/10 w-10 h-10 flex items-center justify-center overflow-hidden">
              <img src={iconUrl} alt="" className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div className={`p-2 rounded-lg bg-primary/10 ${accent}`}>{icon}</div>
          )}
        </div>
        <div className="mt-3">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-xl font-display font-semibold mt-0.5">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function AnaliseVendasCards({ schoolId, orders, items, channels, methods }: Props) {
  const [visibility, setVisibility] = useState<SACardVisibility>(() => loadVisibility(schoolId));
  const { data: products = [] } = useSAProducts(schoolId);

  useEffect(() => { setVisibility(loadVisibility(schoolId)); }, [schoolId]);

  function toggleCard(key: keyof SACardVisibility, value: boolean) {
    const next = { ...visibility, [key]: value };
    setVisibility(next);
    saveVisibility(schoolId, next);
  }

  const stats = useMemo(() => {
    const validOrders = orders.filter(o => o.status !== 'cancelado');
    const orderIds = new Set(validOrders.map(o => o.id));
    const validItems = items.filter(i => orderIds.has(i.order_id));

    const faturamentoBruto = validOrders.reduce((s, o) => s + o.gross_value, 0);
    const totalCusto = validOrders.reduce((s, o) => s + o.cost_total, 0);
    const totalTaxas = validOrders.reduce((s, o) => s + o.fees, 0);
    const totalFrete = validOrders.reduce((s, o) => s + (o.shipping_paid_by_customer ? 0 : o.shipping), 0);
    const lucroBruto = faturamentoBruto - totalCusto - totalTaxas - totalFrete;
    const faturamentoLiquido = lucroBruto;
    const qtdPedidos = validOrders.length;
    const ticketMedio = qtdPedidos > 0 ? faturamentoLiquido / qtdPedidos : 0;
    const margemBruta = faturamentoBruto > 0 ? (lucroBruto / faturamentoBruto) * 100 : 0;

    // Produto mais vendido (qty)
    const productQty = new Map<string, number>();
    const productProfit = new Map<string, number>();
    validItems.forEach(it => {
      const key = it.product_name || '—';
      productQty.set(key, (productQty.get(key) || 0) + Number(it.quantity));
      productProfit.set(key, (productProfit.get(key) || 0) + (Number(it.unit_price) - Number(it.unit_cost)) * Number(it.quantity));
    });
    const topVendido = [...productQty.entries()].sort((a, b) => b[1] - a[1])[0];
    const topLucrativo = [...productProfit.entries()].sort((a, b) => b[1] - a[1])[0];

    // helper to find icon by product name
    const productIconByName = (name: string) =>
      products.find((p: SAProduct) => p.name.toLowerCase() === name.toLowerCase())?.icon_url ?? null;

    // Forma de pagamento mais usada
    const methodCount = new Map<string, number>();
    validOrders.forEach(o => {
      if (o.payment_method_id) methodCount.set(o.payment_method_id, (methodCount.get(o.payment_method_id) || 0) + 1);
    });
    const topMethodEntry = [...methodCount.entries()].sort((a, b) => b[1] - a[1])[0];
    const topMethod = topMethodEntry ? methods.find(m => m.id === topMethodEntry[0])?.name : null;

    // Canal com mais vendas (faturamento)
    const channelRev = new Map<string, number>();
    validOrders.forEach(o => {
      if (o.channel_id) channelRev.set(o.channel_id, (channelRev.get(o.channel_id) || 0) + o.gross_value);
    });
    const topChannelEntry = [...channelRev.entries()].sort((a, b) => b[1] - a[1])[0];
    const topChannel = topChannelEntry ? channels.find(c => c.id === topChannelEntry[0])?.name : null;

    const hasCost = totalCusto > 0;
    const hasChannel = channels.length > 0 && validOrders.some(o => o.channel_id);
    const hasMethod = methods.length > 0 && validOrders.some(o => o.payment_method_id);

    return {
      faturamentoBruto, faturamentoLiquido, qtdPedidos, ticketMedio,
      margemBruta, lucroBruto, totalCusto,
      topVendido, topLucrativo, topMethod, topChannel,
      topVendidoIcon: topVendido ? productIconByName(topVendido[0]) : null,
      topLucrativoIcon: topLucrativo ? productIconByName(topLucrativo[0]) : null,
      hasCost, hasChannel, hasMethod,
    };
  }, [orders, items, channels, methods, products]);

  // Determine which cards make sense (data-aware)
  function canShow(key: keyof SACardVisibility): boolean {
    if (!visibility[key]) return false;
    if (['faturamento_liquido', 'ticket_medio', 'margem_bruta', 'lucro_bruto', 'produto_mais_lucrativo'].includes(key) && !stats.hasCost) return false;
    if (key === 'forma_mais_usada' && !stats.hasMethod) return false;
    if (key === 'canal_top' && !stats.hasChannel) return false;
    return true;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline">
              <Settings2 className="w-4 h-4 mr-1.5" /> Cards
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 max-h-96 overflow-y-auto">
            <p className="text-sm font-semibold mb-2">Mostrar/Ocultar cards</p>
            <p className="text-xs text-muted-foreground mb-3">Cards que dependem de custo, canal ou forma só aparecem quando há dados.</p>
            <div className="space-y-2">
              {(Object.keys(CARD_LABELS) as (keyof SACardVisibility)[]).map(k => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <Label htmlFor={`vis-${k}`} className="text-sm cursor-pointer">{CARD_LABELS[k]}</Label>
                  <Switch id={`vis-${k}`} checked={visibility[k]} onCheckedChange={v => toggleCard(k, v)} />
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {canShow('faturamento_bruto') && (
          <KpiCard icon={<DollarSign className="w-5 h-5" />} label="Faturamento bruto" value={fmtBRL(stats.faturamentoBruto)} />
        )}
        {canShow('faturamento_liquido') && (
          <KpiCard icon={<TrendingUp className="w-5 h-5" />} label="Faturamento líquido" value={fmtBRL(stats.faturamentoLiquido)} hint="Bruto − custos − taxas − frete" />
        )}
        {canShow('qtd_pedidos') && (
          <KpiCard icon={<ShoppingCart className="w-5 h-5" />} label="Pedidos" value={stats.qtdPedidos.toString()} hint="Excluindo cancelados" />
        )}
        {canShow('ticket_medio') && (
          <KpiCard icon={<Receipt className="w-5 h-5" />} label="Ticket médio" value={fmtBRL(stats.ticketMedio)} />
        )}
        {canShow('lucro_bruto') && (
          <KpiCard icon={<BadgeDollarSign className="w-5 h-5" />} label="Lucro bruto" value={fmtBRL(stats.lucroBruto)} />
        )}
        {canShow('margem_bruta') && (
          <KpiCard icon={<Percent className="w-5 h-5" />} label="Margem bruta" value={`${stats.margemBruta.toFixed(1)}%`} />
        )}
        {canShow('produto_mais_vendido') && stats.topVendido && (
          <KpiCard icon={<Crown className="w-5 h-5" />} label="Produto mais vendido" value={stats.topVendido[0]} hint={`${stats.topVendido[1]} unidades`} iconUrl={stats.topVendidoIcon} />
        )}
        {canShow('produto_mais_lucrativo') && stats.topLucrativo && (
          <KpiCard icon={<Star className="w-5 h-5" />} label="Produto mais lucrativo" value={stats.topLucrativo[0]} hint={fmtBRL(stats.topLucrativo[1])} iconUrl={stats.topLucrativoIcon} />
        )}
        {canShow('forma_mais_usada') && stats.topMethod && (
          <KpiCard icon={<CreditCard className="w-5 h-5" />} label="Forma mais usada" value={stats.topMethod} />
        )}
        {canShow('canal_top') && stats.topChannel && (
          <KpiCard icon={<Radio className="w-5 h-5" />} label="Canal com mais vendas" value={stats.topChannel} />
        )}
      </div>
    </div>
  );
}

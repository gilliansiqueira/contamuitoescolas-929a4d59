import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useSAChannels, useSAPaymentMethods, useSAProducts } from './useAnaliseVendasData';
import type { SAOrder, SAOrderItem, SAOrderStatus } from './types';
import { STATUS_LABELS } from './types';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  order: SAOrder | null;
  items: SAOrderItem[];
}

interface DraftItem {
  id?: string;
  product_id: string | null;
  product_name: string;
  quantity: string;
  unit_price: string;
  unit_cost: string;
}

function parseBR(v: string): number {
  if (!v) return 0;
  const cleaned = String(v).replace(/\s/g, '').replace(/R\$/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

const fmt = (n: number) => n.toString().replace('.', ',');

export function PedidoDialog({ open, onOpenChange, schoolId, order, items }: Props) {
  const qc = useQueryClient();
  const { data: products = [] } = useSAProducts(schoolId);
  const { data: channels = [] } = useSAChannels(schoolId);
  const { data: methods = [] } = useSAPaymentMethods(schoolId);

  const today = new Date().toISOString().slice(0, 10);
  const [orderDate, setOrderDate] = useState(today);
  const [customerName, setCustomerName] = useState('');
  const [channelId, setChannelId] = useState<string>('none');
  const [methodId, setMethodId] = useState<string>('none');
  const [status, setStatus] = useState<SAOrderStatus>('concluido');
  const [fees, setFees] = useState('');
  const [shipping, setShipping] = useState('');
  const [shippingPaidByCustomer, setShippingPaidByCustomer] = useState(true);
  const [notes, setNotes] = useState('');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([
    { product_id: null, product_name: '', quantity: '1', unit_price: '', unit_cost: '' },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (order) {
      setOrderDate(order.order_date);
      setCustomerName(order.customer_name || '');
      setChannelId(order.channel_id || 'none');
      setMethodId(order.payment_method_id || 'none');
      setStatus(order.status);
      setFees(order.fees ? fmt(order.fees) : '');
      setShipping(order.shipping ? fmt(order.shipping) : '');
      setShippingPaidByCustomer(order.shipping_paid_by_customer);
      setNotes(order.notes || '');
      setDraftItems(items.length > 0
        ? items.map(it => ({
            id: it.id,
            product_id: it.product_id,
            product_name: it.product_name,
            quantity: fmt(it.quantity),
            unit_price: fmt(it.unit_price),
            unit_cost: fmt(it.unit_cost),
          }))
        : [{ product_id: null, product_name: '', quantity: '1', unit_price: '', unit_cost: '' }]);
    } else {
      setOrderDate(today);
      setCustomerName('');
      setChannelId('none');
      setMethodId('none');
      setStatus('concluido');
      setFees('');
      setShipping('');
      setShippingPaidByCustomer(true);
      setNotes('');
      setDraftItems([{ product_id: null, product_name: '', quantity: '1', unit_price: '', unit_cost: '' }]);
    }
  }, [open, order, items]);

  function selectProduct(idx: number, productId: string) {
    const product = products.find(p => p.id === productId);
    setDraftItems(prev => prev.map((it, i) => i === idx ? {
      ...it,
      product_id: productId,
      product_name: product?.name || '',
      unit_cost: product ? fmt(product.default_cost) : it.unit_cost,
    } : it));
  }

  function updateItem(idx: number, field: keyof DraftItem, value: string) {
    setDraftItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function addItemRow() {
    setDraftItems(prev => [...prev, { product_id: null, product_name: '', quantity: '1', unit_price: '', unit_cost: '' }]);
  }

  function removeItemRow(idx: number) {
    setDraftItems(prev => prev.filter((_, i) => i !== idx));
  }

  const totalGross = draftItems.reduce((s, it) => s + parseBR(it.quantity) * parseBR(it.unit_price), 0);
  const totalCost = draftItems.reduce((s, it) => s + parseBR(it.quantity) * parseBR(it.unit_cost), 0);

  async function handleSave() {
    if (!orderDate) return toast.error('Informe a data');
    const validItems = draftItems.filter(it => it.product_name.trim() && parseBR(it.quantity) > 0);
    if (validItems.length === 0) return toast.error('Adicione pelo menos um item válido');

    setSaving(true);
    try {
      const orderPayload = {
        school_id: schoolId,
        order_date: orderDate,
        customer_name: customerName.trim(),
        channel_id: channelId === 'none' ? null : channelId,
        payment_method_id: methodId === 'none' ? null : methodId,
        status,
        gross_value: totalGross,
        cost_total: totalCost,
        fees: parseBR(fees),
        shipping: parseBR(shipping),
        shipping_paid_by_customer: shippingPaidByCustomer,
        notes: notes.trim(),
      };

      let orderId: string;
      if (order) {
        const { error } = await supabase.from('sales_analysis_orders').update(orderPayload).eq('id', order.id);
        if (error) throw error;
        orderId = order.id;
        await supabase.from('sales_analysis_order_items').delete().eq('order_id', orderId);
      } else {
        const { data, error } = await supabase.from('sales_analysis_orders').insert(orderPayload).select('id').single();
        if (error) throw error;
        orderId = data.id;
      }

      const itemsPayload = validItems.map(it => ({
        order_id: orderId,
        product_id: it.product_id,
        product_name: it.product_name.trim(),
        quantity: parseBR(it.quantity),
        unit_price: parseBR(it.unit_price),
        unit_cost: parseBR(it.unit_cost),
      }));
      const { error: iErr } = await supabase.from('sales_analysis_order_items').insert(itemsPayload);
      if (iErr) throw iErr;

      toast.success(order ? 'Pedido atualizado' : 'Pedido criado');
      qc.invalidateQueries({ queryKey: ['sa_orders', schoolId] });
      qc.invalidateQueries({ queryKey: ['sa_order_items', schoolId] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? 'Editar pedido' : 'Novo pedido'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Data</Label>
            <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
          </div>
          <div>
            <Label>Cliente (opcional)</Label>
            <Input value={customerName} onChange={e => setCustomerName(e.target.value)} />
          </div>
          <div>
            <Label>Canal</Label>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem canal —</SelectItem>
                {channels.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <Select value={methodId} onValueChange={setMethodId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem forma —</SelectItem>
                {methods.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={v => setStatus(v as SAOrderStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Taxas (R$)</Label>
            <Input value={fees} onChange={e => setFees(e.target.value)} placeholder="0,00" />
          </div>
          <div>
            <Label>Frete (R$)</Label>
            <Input value={shipping} onChange={e => setShipping(e.target.value)} placeholder="0,00" />
          </div>
          <div className="flex items-center gap-2 mt-6">
            <input
              type="checkbox"
              id="shipping-paid"
              checked={shippingPaidByCustomer}
              onChange={e => setShippingPaidByCustomer(e.target.checked)}
            />
            <Label htmlFor="shipping-paid" className="cursor-pointer">Frete pago pelo cliente</Label>
          </div>
        </div>

        <div className="space-y-2 mt-2">
          <div className="flex items-center justify-between">
            <Label>Itens do pedido</Label>
            <Button size="sm" variant="outline" onClick={addItemRow}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar item
            </Button>
          </div>
          <div className="space-y-2">
            {draftItems.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 p-2 rounded-md border bg-muted/30">
                <div className="col-span-12 sm:col-span-4">
                  {products.length > 0 ? (
                    <Select value={it.product_id || 'custom'} onValueChange={v => v === 'custom' ? updateItem(idx, 'product_id', '') : selectProduct(idx, v)}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Produto" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">— Texto livre —</SelectItem>
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : null}
                  {(!it.product_id || products.length === 0) && (
                    <Input
                      className="h-9 mt-1"
                      placeholder="Nome do produto"
                      value={it.product_name}
                      onChange={e => updateItem(idx, 'product_name', e.target.value)}
                    />
                  )}
                </div>
                <Input className="h-9 col-span-4 sm:col-span-2" placeholder="Qtd" value={it.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                <Input className="h-9 col-span-4 sm:col-span-2" placeholder="Preço unit." value={it.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} />
                <Input className="h-9 col-span-4 sm:col-span-2" placeholder="Custo unit." value={it.unit_cost} onChange={e => updateItem(idx, 'unit_cost', e.target.value)} />
                <div className="col-span-12 sm:col-span-2 flex items-center justify-end">
                  <span className="text-xs text-muted-foreground mr-2">
                    {(parseBR(it.quantity) * parseBR(it.unit_price)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  {draftItems.length > 1 && (
                    <Button size="icon" variant="ghost" onClick={() => removeItemRow(idx)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-4 text-sm pt-2">
            <span>Bruto: <strong>{totalGross.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
            <span>Custo: <strong>{totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
          </div>
        </div>

        <div>
          <Label>Observações</Label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

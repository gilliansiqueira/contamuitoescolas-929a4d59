import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { useSAChannels, useSAOrderItems, useSAOrders, useSAPaymentMethods, useDeleteOrder } from './useAnaliseVendasData';
import { PedidoDialog } from './PedidoDialog';
import type { SAOrder } from './types';
import { STATUS_LABELS } from './types';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  schoolId: string;
  filterDateFrom: string;
  filterDateTo: string;
  filterChannel: string;
  filterMethod: string;
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function PedidosTable({ schoolId, filterDateFrom, filterDateTo, filterChannel, filterMethod }: Props) {
  const { data: orders = [] } = useSAOrders(schoolId);
  const { data: items = [] } = useSAOrderItems(schoolId);
  const { data: channels = [] } = useSAChannels(schoolId);
  const { data: methods = [] } = useSAPaymentMethods(schoolId);
  const deleteOrder = useDeleteOrder(schoolId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SAOrder | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (filterDateFrom && o.order_date < filterDateFrom) return false;
      if (filterDateTo && o.order_date > filterDateTo) return false;
      if (filterChannel !== 'all' && o.channel_id !== filterChannel) return false;
      if (filterMethod !== 'all' && o.payment_method_id !== filterMethod) return false;
      return true;
    });
  }, [orders, filterDateFrom, filterDateTo, filterChannel, filterMethod]);

  const channelMap = Object.fromEntries(channels.map(c => [c.id, c.name]));
  const methodMap = Object.fromEntries(methods.map(m => [m.id, m.name]));

  function openNew() { setEditing(null); setDialogOpen(true); }
  function openEdit(o: SAOrder) { setEditing(o); setDialogOpen(true); }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Pedidos ({filtered.length})</h3>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo pedido</Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">Data</th>
                <th className="text-left p-2 font-medium">Cliente</th>
                <th className="text-left p-2 font-medium">Canal</th>
                <th className="text-left p-2 font-medium">Forma</th>
                <th className="text-left p-2 font-medium">Status</th>
                <th className="text-right p-2 font-medium">Bruto</th>
                <th className="text-right p-2 font-medium">Líquido</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum pedido encontrado</td></tr>
              )}
              {filtered.map(o => {
                const shippingCost = o.shipping_paid_by_customer ? 0 : o.shipping;
                const liq = o.gross_value - o.cost_total - o.fees - shippingCost;
                return (
                  <tr key={o.id} className="border-t hover:bg-muted/30">
                    <td className="p-2">{o.order_date.split('-').reverse().join('/')}</td>
                    <td className="p-2">{o.customer_name || '—'}</td>
                    <td className="p-2">{channelMap[o.channel_id || ''] || '—'}</td>
                    <td className="p-2">{methodMap[o.payment_method_id || ''] || '—'}</td>
                    <td className="p-2">{STATUS_LABELS[o.status]}</td>
                    <td className="p-2 text-right">{fmtBRL(o.gross_value)}</td>
                    <td className="p-2 text-right">{fmtBRL(liq)}</td>
                    <td className="p-2 flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(o)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(o.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <PedidoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        schoolId={schoolId}
        order={editing}
        items={editing ? items.filter(i => i.order_id === editing.id) : []}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pedido?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. Os itens do pedido também serão removidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmDelete) deleteOrder.mutate(confirmDelete); setConfirmDelete(null); }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

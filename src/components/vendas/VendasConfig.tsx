import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PaymentMethod, CardBrand, PAYMENT_METHODS, CARD_BRANDS, SalesPaymentMethod } from './vendas-types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CreditCard, Smartphone, Receipt, FileText, Banknote, HelpCircle, ArrowLeft } from 'lucide-react';

interface Props {
  schoolId: string;
  onBack: () => void;
}

export function VendasConfig({ schoolId, onBack }: Props) {
  const queryClient = useQueryClient();

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ['sales_payment_methods', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_payment_methods')
        .select('*')
        .eq('school_id', schoolId);
      if (error) throw error;
      return data as SalesPaymentMethod[];
    },
  });

  const toggleMethod = useMutation({
    mutationFn: async ({ payment_method, card_brand, enabled }: { payment_method: PaymentMethod; card_brand: CardBrand | null; enabled: boolean }) => {
      const existing = methods.find(m => m.payment_method === payment_method && m.card_brand === card_brand);
      if (existing) {
        const { error } = await supabase
          .from('sales_payment_methods')
          .update({ enabled })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sales_payment_methods')
          .insert({ school_id: schoolId, payment_method, card_brand, enabled });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales_payment_methods', schoolId] });
      toast.success('Configuração atualizada');
    },
    onError: () => {
      toast.error('Erro ao atualizar configuração');
    }
  });

  const isEnabled = (pm: PaymentMethod, cb: CardBrand | null = null) => {
    return methods.some(m => m.payment_method === pm && m.card_brand === cb && m.enabled);
  };

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Carregando configurações...</div>;

  const creditCardEnabled = isEnabled('credit');

  const getIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'credit': return <CreditCard className="w-4 h-4" />;
      case 'debit': return <CreditCard className="w-4 h-4" />;
      case 'pix': return <Smartphone className="w-4 h-4" />;
      case 'boleto': return <FileText className="w-4 h-4" />;
      case 'check': return <Receipt className="w-4 h-4" />;
      case 'cash': return <Banknote className="w-4 h-4" />;
      default: return <HelpCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Dashboard
        </Button>
      </div>

      <div className="glass-card p-6 rounded-xl space-y-4">
        <h3 className="font-display font-semibold text-lg">Formas de Pagamento Aceitas</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Ative as formas de pagamento que sua instituição utiliza. As opções ativadas aparecerão na tabela de histórico de vendas.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {PAYMENT_METHODS.map(method => (
            <div key={method.value} className="flex items-center justify-between p-4 border border-border rounded-lg bg-surface">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 text-primary rounded-full">
                  {getIcon(method.value)}
                </div>
                <Label htmlFor={`method-${method.value}`} className="font-medium cursor-pointer">
                  {method.label}
                </Label>
              </div>
              <Switch
                id={`method-${method.value}`}
                checked={isEnabled(method.value)}
                onCheckedChange={(checked) => toggleMethod.mutate({ payment_method: method.value, card_brand: null, enabled: checked })}
              />
            </div>
          ))}
        </div>

        {creditCardEnabled && (
          <div className="mt-8 pt-6 border-t border-border">
            <h4 className="font-medium mb-4">Bandeiras de Cartão de Crédito</h4>
            <div className="grid gap-4 md:grid-cols-2">
              {CARD_BRANDS.map(brand => (
                <div key={brand.value} className="flex items-center justify-between p-3 pl-11 border border-border rounded-lg bg-surface relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary/50" />
                  <Label htmlFor={`brand-${brand.value}`} className="font-medium cursor-pointer">
                    {brand.label}
                  </Label>
                  <Switch
                    id={`brand-${brand.value}`}
                    checked={isEnabled('credit', brand.value)}
                    onCheckedChange={(checked) => toggleMethod.mutate({ payment_method: 'credit', card_brand: brand.value, enabled: checked })}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

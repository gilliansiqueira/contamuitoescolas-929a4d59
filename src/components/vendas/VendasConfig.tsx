import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PAYMENT_METHODS, SalesPaymentMethod, SalesCardBrand } from './vendas-types';
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

  const { data: methods = [], isLoading: loadingMethods } = useQuery({
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

  const { data: cardBrands = [], isLoading: loadingBrands } = useQuery({
    queryKey: ['sales_card_brands'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_card_brands')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as SalesCardBrand[];
    },
  });

  const toggleMethod = useMutation({
    mutationFn: async ({ method_key, label, enabled }: { method_key: string; label: string; enabled: boolean }) => {
      const existing = methods.find(m => m.method_key === method_key);
      if (existing) {
        const { error } = await supabase
          .from('sales_payment_methods')
          .update({ enabled })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sales_payment_methods')
          .insert({ school_id: schoolId, method_key, label, enabled });
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

  const isEnabled = (key: string) => {
    return methods.some(m => m.method_key === key && m.enabled);
  };

  if (loadingMethods || loadingBrands) return <div className="p-4 text-sm text-muted-foreground">Carregando configurações...</div>;

  const creditCardEnabled = isEnabled('credit') || isEnabled('credit_card');

  const getIcon = (method: string) => {
    switch (method) {
      case 'credit': return <CreditCard className="w-4 h-4" />;
      case 'credit_card': return <CreditCard className="w-4 h-4" />;
      case 'debit': return <CreditCard className="w-4 h-4" />;
      case 'pix': return <Smartphone className="w-4 h-4" />;
      case 'boleto': return <FileText className="w-4 h-4" />;
      case 'check': return <Receipt className="w-4 h-4" />;
      case 'cash': return <Banknote className="w-4 h-4" />;
      default: return <HelpCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
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
            <div key={method.value} className="flex items-center justify-between p-4 border border-border rounded-lg bg-surface relative overflow-hidden transition-all hover:border-primary/50">
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
                onCheckedChange={(checked) => toggleMethod.mutate({ method_key: method.value, label: method.label, enabled: checked })}
              />
            </div>
          ))}
        </div>

        {creditCardEnabled && cardBrands.length > 0 && (
          <div className="mt-8 pt-6 border-t border-border">
            <h4 className="font-medium mb-4">Bandeiras de Cartão</h4>
            <div className="grid gap-4 md:grid-cols-2">
              {cardBrands.map(brand => (
                <div key={brand.id} className="flex items-center justify-between p-3 pl-4 border border-border rounded-lg bg-surface relative transition-all hover:border-primary/50">
                  <div className="flex items-center gap-3">
                    {brand.icon_url ? (
                      <img src={brand.icon_url} alt={brand.name} className="w-6 h-6 object-contain" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                    )}
                    <Label htmlFor={`brand-${brand.id}`} className="font-medium cursor-pointer">
                      {brand.name}
                    </Label>
                  </div>
                  <Switch
                    id={`brand-${brand.id}`}
                    checked={isEnabled(`brand-${brand.id}`)}
                    onCheckedChange={(checked) => toggleMethod.mutate({ method_key: `brand-${brand.id}`, label: `${brand.name}`, enabled: checked })}
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

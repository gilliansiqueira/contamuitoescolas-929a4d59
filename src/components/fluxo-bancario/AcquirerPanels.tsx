import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MercadoPagoPanel } from './MercadoPagoPanel';
import { AsaasPanel } from './AsaasPanel';

const db = supabase as any;
const OPTS = [
  { provider: 'mercadopago', feature: 'mercadopago_conector', nome: 'Mercado Pago' },
  { provider: 'asaas', feature: 'asaas_conector', nome: 'Asaas' },
] as const;

/** Mostra só os conectores de recebimento que a empresa usa (feature ligada ou conexão já existente). */
export function AcquirerPanels({ schoolId }: { schoolId: string }) {
  const { isSuperAdmin } = useAuth() as any;
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['acquirer_visible', schoolId],
    queryFn: async () => {
      const [f, c] = await Promise.all([
        db.from('school_features').select('feature_key,enabled').eq('school_id', schoolId).in('feature_key', OPTS.map(o => o.feature)),
        db.from('acquirer_connections').select('provider,has_token').eq('school_id', schoolId),
      ]);
      return { feats: (f.data ?? []) as any[], conns: (c.data ?? []) as any[] };
    },
  });
  if (!data) return null;
  const on = (o: typeof OPTS[number]) => data.feats.some(f => f.feature_key === o.feature && f.enabled) || data.conns.some(c => c.provider === o.provider);
  const hasToken = (o: typeof OPTS[number]) => data.conns.some(c => c.provider === o.provider && c.has_token);
  const set = async (o: typeof OPTS[number], enabled: boolean) => {
    await db.from('school_features').delete().eq('school_id', schoolId).eq('feature_key', o.feature);
    const { error } = enabled ? await db.from('school_features').insert({ school_id: schoolId, feature_key: o.feature, enabled: true }) : { error: null };
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ['acquirer_visible', schoolId] });
  };
  const visible = OPTS.filter(on);
  const available = OPTS.filter(o => !on(o));
  return (
    <>
      {visible.map(o => (
        <div key={o.provider} className="relative">
          {isSuperAdmin && !hasToken(o) && (
            <Button size="icon" variant="ghost" className="absolute right-2 top-2 z-10 h-6 w-6" title={`Remover ${o.nome} desta empresa`} onClick={() => set(o, false)}><X className="h-3.5 w-3.5" /></Button>
          )}
          {o.provider === 'mercadopago' ? <MercadoPagoPanel schoolId={schoolId} /> : <AsaasPanel schoolId={schoolId} />}
        </div>
      ))}
      {isSuperAdmin && available.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="text-xs text-muted-foreground"><Plus className="mr-1 h-3.5 w-3.5" />Adicionar integração</Button></DropdownMenuTrigger>
          <DropdownMenuContent>{available.map(o => <DropdownMenuItem key={o.provider} onClick={() => set(o, true)}>{o.nome}</DropdownMenuItem>)}</DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Plus, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useSAChannels, useSAPaymentMethods, useSAProducts } from './useAnaliseVendasData';
import { IconPicker } from './IconPicker';
import { IconesGallery } from './IconesGallery';
import { ImportacaoVendas } from './ImportacaoVendas';

interface Props {
  schoolId: string;
  onBack: () => void;
}

function parseBR(v: string): number {
  if (!v) return 0;
  const cleaned = v.replace(/\s/g, '').replace(/R\$/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export function CadastrosConfig({ schoolId, onBack }: Props) {
  const qc = useQueryClient();
  const { data: products = [] } = useSAProducts(schoolId);
  const { data: channels = [] } = useSAChannels(schoolId);
  const { data: methods = [] } = useSAPaymentMethods(schoolId);

  const [newProduct, setNewProduct] = useState({ name: '', cost: '' });
  const [newChannel, setNewChannel] = useState('');
  const [newMethod, setNewMethod] = useState('');

  async function addProduct() {
    if (!newProduct.name.trim()) return;
    const { error } = await supabase.from('sales_analysis_products').insert({
      school_id: schoolId,
      name: newProduct.name.trim(),
      default_cost: parseBR(newProduct.cost),
    });
    if (error) return toast.error(error.message);
    setNewProduct({ name: '', cost: '' });
    qc.invalidateQueries({ queryKey: ['sa_products', schoolId] });
  }

  async function addChannel() {
    if (!newChannel.trim()) return;
    const { error } = await supabase.from('sales_analysis_channels').insert({
      school_id: schoolId, name: newChannel.trim(),
    });
    if (error) return toast.error(error.message);
    setNewChannel('');
    qc.invalidateQueries({ queryKey: ['sa_channels', schoolId] });
  }

  async function addMethod() {
    if (!newMethod.trim()) return;
    const { error } = await supabase.from('sales_analysis_payment_methods').insert({
      school_id: schoolId, name: newMethod.trim(),
    });
    if (error) return toast.error(error.message);
    setNewMethod('');
    qc.invalidateQueries({ queryKey: ['sa_payment_methods', schoolId] });
  }

  async function delProduct(id: string) {
    await supabase.from('sales_analysis_products').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['sa_products', schoolId] });
  }
  async function delChannel(id: string) {
    await supabase.from('sales_analysis_channels').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['sa_channels', schoolId] });
  }
  async function delMethod(id: string) {
    await supabase.from('sales_analysis_payment_methods').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['sa_payment_methods', schoolId] });
  }

  async function updateProductCost(id: string, value: string) {
    await supabase.from('sales_analysis_products').update({ default_cost: parseBR(value) }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['sa_products', schoolId] });
  }

  async function updateProductIcon(id: string, iconUrl: string | null) {
    await supabase.from('sales_analysis_products').update({ icon_url: iconUrl }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['sa_products', schoolId] });
  }

  return (
    <div className="space-y-4">
      <Button size="sm" variant="ghost" onClick={onBack} className="rounded-xl">
        <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
      </Button>

      <Tabs defaultValue="produtos">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="canais">Canais</TabsTrigger>
          <TabsTrigger value="formas">Formas de pagamento</TabsTrigger>
          <TabsTrigger value="importacao">Importação</TabsTrigger>
          <TabsTrigger value="icones">Ícones</TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Produtos</CardTitle>
              <p className="text-sm text-muted-foreground">Cadastre produtos com custo padrão e ícone. O custo será sugerido nos pedidos.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Nome do produto" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} />
                <Input placeholder="Custo (R$)" className="w-40" value={newProduct.cost} onChange={e => setNewProduct({ ...newProduct, cost: e.target.value })} />
                <Button onClick={addProduct}><Plus className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-1.5">
                {products.length === 0 && <p className="text-sm text-muted-foreground">Nenhum produto cadastrado.</p>}
                {products.map(p => (
                  <div key={p.id} className="flex items-center gap-2 p-2 rounded-md border bg-card">
                    <IconPicker schoolId={schoolId} value={p.icon_url} onChange={url => updateProductIcon(p.id, url)} />
                    <span className="flex-1 text-sm">{p.name}</span>
                    <Input
                      defaultValue={p.default_cost.toString().replace('.', ',')}
                      onBlur={e => updateProductCost(p.id, e.target.value)}
                      className="w-32 h-8 text-sm"
                      placeholder="Custo"
                    />
                    <Button size="icon" variant="ghost" onClick={() => delProduct(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="canais" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Canais de venda</CardTitle>
              <p className="text-sm text-muted-foreground">Ex: Instagram, Indicação, Site, Loja física.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Nome do canal" value={newChannel} onChange={e => setNewChannel(e.target.value)} />
                <Button onClick={addChannel}><Plus className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-1.5">
                {channels.length === 0 && <p className="text-sm text-muted-foreground">Nenhum canal cadastrado.</p>}
                {channels.map(c => (
                  <div key={c.id} className="flex items-center gap-2 p-2 rounded-md border bg-card">
                    <span className="flex-1 text-sm">{c.name}</span>
                    <Button size="icon" variant="ghost" onClick={() => delChannel(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="formas" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Formas de pagamento</CardTitle>
              <p className="text-sm text-muted-foreground">Independentes da aba "Vendas". Ex: PIX, Cartão, Boleto.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Nome da forma" value={newMethod} onChange={e => setNewMethod(e.target.value)} />
                <Button onClick={addMethod}><Plus className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-1.5">
                {methods.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma forma cadastrada.</p>}
                {methods.map(m => (
                  <div key={m.id} className="flex items-center gap-2 p-2 rounded-md border bg-card">
                    <span className="flex-1 text-sm">{m.name}</span>
                    <Button size="icon" variant="ghost" onClick={() => delMethod(m.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="importacao" className="mt-4">
          <ImportacaoVendas schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="icones" className="mt-4">
          <IconesGallery schoolId={schoolId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

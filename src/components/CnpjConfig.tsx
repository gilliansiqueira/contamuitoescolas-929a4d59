import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Ent { id: string; nome: string; cnpj: string; sort_order: number }

/** Cadastro dos CNPJs da empresa (usado no filtro global de CNPJ). */
export function CnpjConfig({ schoolId }: { schoolId: string }) {
  const [list, setList] = useState<Ent[]>([]);
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const t = () => supabase.from('company_entities' as any);
  const load = async () => {
    const { data } = await t().select('*').eq('school_id', schoolId).order('sort_order');
    setList((data as any) || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [schoolId]);

  const add = async () => {
    if (!nome.trim()) return;
    const { error } = await t().insert({ school_id: schoolId, nome: nome.trim(), cnpj: cnpj.trim(), sort_order: list.length + 1 });
    if (error) return toast.error('Só administradores podem cadastrar CNPJs');
    setNome(''); setCnpj(''); load();
  };
  const save = async (e: Ent) => {
    const { error } = await t().update({ nome: e.nome, cnpj: e.cnpj }).eq('id', e.id);
    if (error) toast.error('Erro ao salvar'); else toast.success('CNPJ salvo');
  };
  const del = async (id: string) => {
    if (!confirm('Excluir este CNPJ? Os lançamentos dele ficam como "Sem CNPJ definido".')) return;
    await t().delete().eq('id', id); load();
  };

  return (
    <Card className="rounded-2xl mt-4">
      <CardContent className="p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">CNPJs da empresa</h3>
          <p className="text-xs text-muted-foreground">Com 2 ou mais CNPJs, aparece o filtro "CNPJ" no topo, válido para todas as abas. Recarregue a página após alterar.</p>
        </div>
        {list.map((e, i) => (
          <div key={e.id} className="flex gap-2">
            <Input className="rounded-xl" value={e.nome} onChange={ev => setList(l => l.map((x, j) => j === i ? { ...x, nome: ev.target.value } : x))} onBlur={() => save(list[i])} />
            <Input className="rounded-xl w-52" placeholder="00.000.000/0000-00" value={e.cnpj} onChange={ev => setList(l => l.map((x, j) => j === i ? { ...x, cnpj: ev.target.value } : x))} onBlur={() => save(list[i])} />
            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del(e.id)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input className="rounded-xl" placeholder="Nome (ex.: QdC Expedições)" value={nome} onChange={e => setNome(e.target.value)} />
          <Input className="rounded-xl w-52" placeholder="CNPJ" value={cnpj} onChange={e => setCnpj(e.target.value)} />
          <Button className="rounded-xl gap-1" onClick={add}><Plus className="w-4 h-4" /> Adicionar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

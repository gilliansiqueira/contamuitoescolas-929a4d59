import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useJustificationReasons, useManageReasons, JUSTIFICATION_START } from '@/hooks/useReconJustification';

/** Motivos padrão para justificar pendências de conciliação (só super admin). */
export function ReconReasonsConfig() {
  const { data: reasons = [], isLoading } = useJustificationReasons();
  const { add, toggle, remove } = useManageReasons();
  const [nome, setNome] = useState('');
  const submit = () => {
    const v = nome.trim();
    if (v.length < 3 || v.length > 80) return toast.error('Use de 3 a 80 caracteres');
    add.mutate(v, { onSuccess: () => { setNome(''); toast.success('Motivo adicionado'); }, onError: (e: any) => toast.error(e.message) });
  };
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h2 className="font-display text-2xl font-bold">Motivos de justificativa</h2>
        <p className="text-sm text-muted-foreground">Lista de motivos disponíveis quando uma pendência de conciliação continua em aberto. Obrigatório para lançamentos a partir de {JUSTIFICATION_START.split('-').reverse().join('/')}.</p>
      </div>
      <div className="flex gap-2 rounded-xl border border-border bg-card p-4 shadow-sm">
        <Input value={nome} maxLength={80} onChange={e => setNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="Ex: Aguardando contador" />
        <Button onClick={submit} disabled={add.isPending}>Adicionar</Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-left font-medium">Nome</th><th className="p-3 text-left font-medium">Status</th><th className="p-3 text-right font-medium">Ações</th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={3} className="p-4 text-muted-foreground">Carregando…</td></tr>}
            {reasons.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className={`p-3 font-semibold ${r.ativo ? '' : 'text-muted-foreground line-through'}`}>{r.nome}</td>
                <td className="p-3"><button type="button" className={`text-xs underline ${r.ativo ? 'text-foreground' : 'text-muted-foreground'}`} title="Clique para alternar"
                  onClick={() => toggle.mutate({ id: r.id, ativo: !r.ativo }, { onError: (e: any) => toast.error(e.message) })}>{r.ativo ? 'Ativo' : 'Inativo'}</button></td>
                <td className="p-3 text-right"><Button size="sm" variant="ghost" aria-label="Excluir" onClick={() => {
                  if (!confirm(`Excluir "${r.nome}"? Se já foi usado, ele só será desativado para manter o histórico.`)) return;
                  remove.mutate(r.id, { onSuccess: res => toast.success(res === 'apagado' ? 'Motivo excluído' : 'Motivo já usado: foi desativado'), onError: (e: any) => toast.error(e.message) });
                }}><Trash2 className="h-4 w-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

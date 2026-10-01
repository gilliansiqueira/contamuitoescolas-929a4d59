import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileUp, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { parseCartaoPonto, readPdfTokens, type CartaoRelatorio } from '@/lib/teamTime/cartaoPontoParser';
import { useTeamTimeImportReport } from '@/hooks/useTeamTime';

const fmt = (d: string | null) => d ? d.split('-').reverse().join('/') : '—';

/** Importa o "Relatório de Cartão Ponto Individual" do PontoFopag com conferência antes de gravar. */
export function ImportCartaoPonto() {
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [file, setFile] = useState('');
  const [rep, setRep] = useState<CartaoRelatorio | null>(null);
  const save = useTeamTimeImportReport();

  const onFile = async (f?: File) => {
    if (!f) return;
    setReading(true);
    try { setRep(parseCartaoPonto(await readPdfTokens(await f.arrayBuffer()))); setFile(f.name); }
    catch { toast.error('Não foi possível ler o PDF.'); }
    finally { setReading(false); if (input.current) input.current.value = ''; }
  };

  const confirm = async () => {
    if (!rep?.periodoInicio || !rep.periodoFim) return;
    try {
      const r = await save.mutateAsync({ arquivo: file, periodoInicio: rep.periodoInicio, periodoFim: rep.periodoFim,
        funcionarios: rep.funcionarios.map(({ codigo, nome, matricula, departamento, funcao, dias }) => ({ codigo, nome, matricula, departamento, funcao, dias })) });
      toast.success(`Ponto importado: ${r.counts.funcionarios} funcionários, ${r.counts.dias} dias.`); setRep(null);
    } catch (e: any) { toast.error(e.message ?? 'Erro ao gravar'); }
  };

  const blocked = !rep || rep.divergencias.length > 0 || !rep.periodoInicio;
  return (
    <>
      <input ref={input} type="file" accept="application/pdf" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
      <Button size="sm" variant="outline" className="h-9 gap-1.5" disabled={reading} onClick={() => input.current?.click()}>
        {reading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}Importar relatório de ponto (PDF)
      </Button>
      <Dialog open={!!rep} onOpenChange={o => !o && setRep(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Conferência do relatório de ponto</DialogTitle></DialogHeader>
          {rep && <div className="space-y-3 text-sm">
            <p>{rep.funcionarios.length} funcionário(s) · período {fmt(rep.periodoInicio)} a {fmt(rep.periodoFim)} · CPF e PIS não são gravados.</p>
            {rep.divergencias.length > 0
              ? <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive"><p className="flex items-center gap-1.5 font-medium"><AlertTriangle className="h-4 w-4" />Importação bloqueada: os totais não batem.</p><ul className="mt-1 list-disc pl-5 text-xs">{rep.divergencias.map(d => <li key={d}>{d}</li>)}</ul></div>
              : <p className="flex items-center gap-1.5 text-success"><CheckCircle2 className="h-4 w-4" />Todos os totais conferem com o relatório.</p>}
            <div className="max-h-80 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted text-muted-foreground"><tr><th className="p-2 text-left">Funcionário</th><th className="p-2 text-right">Dias</th><th className="p-2 text-right">Trabalhadas</th><th className="p-2 text-right">Extras</th><th className="p-2 text-right">Faltas</th><th className="p-2 text-left">Ocorrências</th></tr></thead>
                <tbody>{rep.funcionarios.map(f => (
                  <tr key={f.codigo} className={`border-t border-border ${f.divergencias.length ? 'bg-destructive/5' : ''}`}>
                    <td className="p-2">{f.nome}</td>
                    <td className="p-2 text-right tabular-nums">{f.dias.length}</td>
                    <td className="p-2 text-right tabular-nums">{f.somados.trabalhadas}</td>
                    <td className="p-2 text-right tabular-nums">{f.somados.extras}</td>
                    <td className="p-2 text-right tabular-nums">{f.somados.faltas}</td>
                    <td className="p-2">{[...new Set(f.dias.map(d => d.observacao).filter(Boolean))].join(', ') || '—'}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </div>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRep(null)}>Cancelar</Button>
            <Button disabled={blocked || save.isPending} onClick={confirm}>{save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Gravar no Ponto da Equipe</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

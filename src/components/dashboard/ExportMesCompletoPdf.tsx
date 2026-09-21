import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { MesCompletoData } from './pdf/mesCompletoPdf';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Props {
  /** Monta os dados no momento do clique (evita cálculo desnecessário) */
  buildData: () => MesCompletoData | Promise<MesCompletoData>;
}

export function ExportMesCompletoPdf({ buildData }: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const { generateMesCompletoPdf } = await import('./pdf/mesCompletoPdf');
      const data = await buildData();
      await generateMesCompletoPdf(data);
      toast.success('Relatório geral gerado');
    } catch (err) {
      console.error('[ExportMesCompletoPdf]', err);
      toast.error('Não foi possível gerar o relatório geral');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" disabled={busy} className="gap-1.5 shadow-sm">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Relatório geral (PDF)
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Gerar relatório geral?</AlertDialogTitle>
          <AlertDialogDescription>
            O PDF usará o período selecionado e incluirá resumo financeiro, evolução do saldo, despesas detalhadas, indicadores, conversão, matrículas e anexos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleClick}>Gerar PDF</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

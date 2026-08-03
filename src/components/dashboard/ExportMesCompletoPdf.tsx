import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateMesCompletoPdf, type MesCompletoData } from './pdf/mesCompletoPdf';

interface Props {
  /** Monta os dados no momento do clique (evita cálculo desnecessário) */
  buildData: () => MesCompletoData;
}

export function ExportMesCompletoPdf({ buildData }: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      await generateMesCompletoPdf(buildData());
      toast.success('PDF do mês gerado');
    } catch (err) {
      console.error('[ExportMesCompletoPdf]', err);
      toast.error('Não foi possível gerar o PDF do mês');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" onClick={handleClick} disabled={busy} className="gap-1.5 shadow-sm">
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
      Exportar mês completo (PDF)
    </Button>
  );
}

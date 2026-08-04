/**
 * Exporta a tela de projeção (Dashboard) para PDF em alta resolução,
 * sem depender de print manual — funciona igual no desktop e no mobile.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  /** Elemento a capturar */
  targetRef: React.RefObject<HTMLElement>;
  fileName?: string;
}

export function ExportProjecaoPdf({ targetRef, fileName = 'projecao' }: Props) {
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    const el = targetRef.current;
    if (!el) return;
    setBusy(true);
    try {
      const { exportElementToPdf } = await import('@/lib/pdfCapture');
      await exportElementToPdf(el, fileName);
      toast.success('PDF gerado');
    } catch (err) {
      console.error('[ExportProjecaoPdf]', err);
      toast.error('Não foi possível gerar o PDF');
    } finally {
      setBusy(false);
    }
  };


  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={busy}>
      {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileDown className="w-4 h-4 mr-1" />}
      Exportar PDF
    </Button>
  );
}

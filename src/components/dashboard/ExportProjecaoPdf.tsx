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
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
        windowWidth: Math.max(el.scrollWidth, 1100),
        onclone: (doc) => {
          doc.querySelectorAll('[data-export-hide]').forEach(n => {
            (n as HTMLElement).style.display = 'none';
          });
        },
      });


      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;

      const img = canvas.toDataURL('image/jpeg', 0.95);
      let remaining = imgH;
      let position = margin;

      pdf.addImage(img, 'JPEG', margin, position, imgW, imgH);
      remaining -= pageH - margin * 2;

      while (remaining > 0) {
        pdf.addPage();
        position -= pageH - margin * 2;
        pdf.addImage(img, 'JPEG', margin, position, imgW, imgH);
        remaining -= pageH - margin * 2;
      }

      pdf.save(`${fileName}.pdf`);
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

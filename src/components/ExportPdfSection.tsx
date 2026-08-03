/**
 * Envolve o conteúdo de uma aba e adiciona o botão "Exportar PDF"
 * reaproveitando o componente ExportProjecaoPdf (html2canvas + jsPDF).
 * O botão fica fora da área capturada, portanto não aparece no PDF.
 */
import { useRef, ReactNode } from 'react';
import { ExportProjecaoPdf } from '@/components/dashboard/ExportProjecaoPdf';

interface Props {
  fileName: string;
  children: ReactNode;
  className?: string;
}

export function ExportPdfSection({ fileName, children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className={className}>
      <div className="flex justify-end mb-2 sm:mb-3" data-export-hide>
        <ExportProjecaoPdf targetRef={ref} fileName={fileName} />
      </div>
      <div ref={ref}>{children}</div>
    </div>
  );
}

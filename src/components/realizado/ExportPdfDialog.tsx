import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Loader2 } from 'lucide-react';
import { PrintableReport } from './pdf/PrintableReport';
import { generatePdfFromElement } from './pdf/pdfGenerator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  selectedMonth: string; // MM
  selectedYear: string;  // YYYY
}

export function ExportPdfDialog({ open, onOpenChange, schoolId, selectedMonth, selectedYear }: Props) {
  const [generatingWithTheme, setGeneratingWithTheme] = useState<'light' | 'dark' | null>(null);

  const startExport = (theme: 'light' | 'dark') => {
    setGeneratingWithTheme(theme);
  };

  const handleReady = async (element: HTMLDivElement, schoolName: string) => {
    try {
      const monthLabel = format(new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1), 'MMMM', { locale: ptBR });
      const safeSchool = schoolName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileName = `Relatorio_Realizado_${safeSchool}_${monthLabel}_${selectedYear}.pdf`;

      await generatePdfFromElement(element, fileName);
    } catch (err) {
      console.error('Error generating PDF', err);
    } finally {
      setGeneratingWithTheme(null);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={generatingWithTheme ? undefined : onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar Relatório PDF</DialogTitle>
          </DialogHeader>

          {generatingWithTheme ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Buscando dados e formatando PDF...</p>
              <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos.</p>
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground text-center mb-6">
                Escolha o formato visual de cores que deseja exportar.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  variant="outline" 
                  className="h-24 flex flex-col gap-2 hover:border-primary/50"
                  onClick={() => startExport('light')}
                >
                  <Sun className="w-6 h-6" />
                  <span>Modo Claro</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-24 flex flex-col gap-2 bg-slate-950 text-white hover:bg-slate-900 border-transparent hover:border-primary/50"
                  onClick={() => startExport('dark')}
                >
                  <Moon className="w-6 h-6" />
                  <span>Modo Escuro</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Render invisible elements for print layout capture */}
      {generatingWithTheme && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '1024px', opacity: 0, pointerEvents: 'none' }}>
          <PrintableReport 
            theme={generatingWithTheme} 
            schoolId={schoolId} 
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onReady={handleReady} 
          />
        </div>
      )}
    </>
  );
}

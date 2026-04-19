import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, FileText } from 'lucide-react';
import { generateFechamentoPdf } from './pdf/fechamentoPdf';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  selectedMonth: string; // MM
  selectedYear: string;  // YYYY
}

export function ExportPdfDialog({ open, onOpenChange, schoolId, selectedMonth, selectedYear }: Props) {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateFechamentoPdf({ schoolId, selectedMonth, selectedYear });
      toast.success('Relatório gerado com sucesso');
      onOpenChange(false);
    } catch (err) {
      console.error('Error generating PDF', err);
      toast.error('Falha ao gerar o relatório');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={generating ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Relatório de Fechamento Financeiro</DialogTitle>
          <DialogDescription>
            Gera um PDF com o resumo do mês: projeção, resultado realizado, despesas detalhadas, indicadores, conversão e vendas — com comparação ao mês anterior.
          </DialogDescription>
        </DialogHeader>

        {generating ? (
          <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Compondo o relatório de fechamento...</p>
            <p className="text-xs text-muted-foreground">Isso leva poucos segundos.</p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <Button onClick={handleGenerate} className="w-full h-12 gap-2">
              <FileText className="w-5 h-5" />
              Gerar Relatório de Fechamento
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useRef } from 'react';
import { useEntriesFromBaseDate, useSchool } from '@/hooks/useFinancialData';
import { matchesMonthFilter } from '@/components/MonthSelector';
import { Button } from '@/components/ui/button';
import { Upload, FileJson, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

interface ExportImportProps {
  schoolId: string;
  selectedMonth?: string;
  onDataChanged: () => void;
}

export function ExportImport({ schoolId, selectedMonth = 'all', onDataChanged }: ExportImportProps) {
  const { data: school } = useSchool(schoolId);
  const { data: allEntries = [] } = useEntriesFromBaseDate(schoolId, school?.saldoInicialData);

  const handleExportCSV = () => {
    const entries = allEntries.filter(e => matchesMonthFilter(e.data, selectedMonth));
    if (entries.length === 0) {
      toast.error('Nenhum dado para exportar no período selecionado');
      return;
    }
    const header = 'data,descricao,valor,tipo,categoria,origem,tipo_original,classificacao\n';
    const rows = entries.map(e => {
      const classificacao = e.origem === 'fluxo' ? 'Realizado' : 'Projetado';
      return `${e.data},"${e.descricao}",${e.valor},${e.tipo},"${e.categoria}",${e.origem},"${e.tipoOriginal || ''}",${classificacao}`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const periodLabel = selectedMonth === 'all' ? 'todos' : selectedMonth.replace(/,/g, '_');
    a.download = `dados_${schoolId}_${periodLabel}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`CSV exportado (${entries.length} registros do período)`);
  };

  const handleExportJSON = () => {
    const entries = allEntries.filter(e => matchesMonthFilter(e.data, selectedMonth));
    const exportData = {
      exportedAt: new Date().toISOString(),
      schoolId,
      selectedMonth,
      entries,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${schoolId}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup JSON exportado com sucesso!');
  };

  const handleImportInfo = () => {
    toast.info('Para importar dados, use a aba "Upload de Dados". O import por JSON está disponível apenas em modo local.');
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <h3 className="font-display font-semibold">Exportar / Importar</h3>
      <p className="text-xs text-muted-foreground">
        A exportação CSV respeita o período selecionado e inclui a classificação (Realizado/Projetado).
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleExportJSON} variant="outline" size="sm">
          <FileJson className="w-4 h-4 mr-2" />
          Exportar Backup (JSON)
        </Button>
        <Button onClick={handleExportCSV} variant="outline" size="sm">
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Exportar CSV ({selectedMonth === 'all' ? 'Todos' : 'Período'})
        </Button>
        <Button onClick={handleImportInfo} variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-2" />
          Importar dados
        </Button>
      </div>
      <p className="text-xs text-muted-foreground pt-2">
        💡 Os dados são salvos automaticamente no Supabase e compartilhados entre todos os usuários.
      </p>
    </div>
  );
}

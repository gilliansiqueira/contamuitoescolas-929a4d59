import { useRef } from 'react';
import { exportAllData, importAllData, getEntries } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Download, Upload, FileJson, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

interface ExportImportProps {
  schoolId: string;
  onDataChanged: () => void;
}

export function ExportImport({ schoolId, onDataChanged }: ExportImportProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExportJSON = () => {
    const data = exportAllData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `projecao_financeira_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup exportado com sucesso!');
  };

  const handleExportCSV = () => {
    const entries = getEntries(schoolId);
    if (entries.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }
    const header = 'data,descricao,valor,tipo,categoria,origem\n';
    const rows = entries.map(e =>
      `${e.data},"${e.descricao}",${e.valor},${e.tipo},"${e.categoria}",${e.origem}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dados_${schoolId}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado com sucesso!');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (importAllData(text)) {
        toast.success('Dados importados com sucesso!');
        onDataChanged();
      } else {
        toast.error('Arquivo inválido. Verifique o formato JSON.');
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <h3 className="font-display font-semibold">Exportar / Importar</h3>
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleExportJSON} variant="outline" size="sm">
          <FileJson className="w-4 h-4 mr-2" />
          Exportar Backup (JSON)
        </Button>
        <Button onClick={handleExportCSV} variant="outline" size="sm">
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Exportar CSV da Escola
        </Button>
        <label>
          <Button asChild variant="outline" size="sm">
            <span>
              <Upload className="w-4 h-4 mr-2" />
              Importar Backup (JSON)
            </span>
          </Button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </label>
      </div>
    </div>
  );
}

import { useState, useCallback } from 'react';
import { PlanoDeContas } from './PlanoDeContas';
import { ImportacaoRealizado } from './ImportacaoRealizado';
import { RelatorioRealizado } from './RelatorioRealizado';
import { HistoricoUploads } from './HistoricoUploads';
import { ExportacaoDados } from './ExportacaoDados';
import { Indicadores } from '@/components/Indicadores';
import { Settings, ChevronLeft, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  schoolId: string;
}

type ConfigTab = 'plano' | 'importacao' | 'historico' | 'dados';
type MainView = 'relatorio' | 'indicadores';

const configTabs: { key: ConfigTab; label: string }[] = [
  { key: 'plano', label: 'Plano de Contas' },
  { key: 'importacao', label: 'Importação' },
  { key: 'historico', label: 'Histórico' },
  { key: 'dados', label: 'Exportar Dados' },
];

export function RealizadoModule({ schoolId }: Props) {
  const [showConfig, setShowConfig] = useState(false);
  const [configTab, setConfigTab] = useState<ConfigTab>('importacao');
  const [mainView, setMainView] = useState<MainView>('relatorio');
  const queryClient = useQueryClient();

  const handleBackToReport = useCallback(() => {
    setShowConfig(false);
    queryClient.invalidateQueries({ queryKey: ['realized_entries', schoolId] });
    queryClient.invalidateQueries({ queryKey: ['chart_of_accounts', schoolId] });
  }, [queryClient, schoolId]);

  if (showConfig) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Button size="sm" variant="ghost" onClick={handleBackToReport} className="rounded-xl">
            <ChevronLeft className="w-4 h-4 mr-1" /> Voltar ao Relatório
          </Button>
        </div>
        <div className="flex gap-1 mb-4 border-b border-border/50">
          {configTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setConfigTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 rounded-t-lg ${
                configTab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <motion.div key={configTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
          {configTab === 'plano' && <PlanoDeContas schoolId={schoolId} />}
          {configTab === 'importacao' && <ImportacaoRealizado schoolId={schoolId} />}
          {configTab === 'historico' && <HistoricoUploads schoolId={schoolId} />}
          {configTab === 'dados' && <ExportacaoDados schoolId={schoolId} />}
        </motion.div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMainView('relatorio')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              mainView === 'relatorio'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            Análise de Despesas
          </button>
          <button
            onClick={() => setMainView('indicadores')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              mainView === 'indicadores'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Gauge className="w-4 h-4" />
            Indicadores
          </button>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowConfig(true)} className="rounded-xl">
          <Settings className="w-4 h-4 mr-1" /> Configurações
        </Button>
      </div>
      <motion.div key={mainView} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
        {mainView === 'relatorio' && <RelatorioRealizado schoolId={schoolId} />}
        {mainView === 'indicadores' && <Indicadores schoolId={schoolId} />}
      </motion.div>
    </div>
  );
}

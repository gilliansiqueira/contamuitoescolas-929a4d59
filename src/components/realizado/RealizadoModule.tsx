import { useState } from 'react';
import { PlanoDeContas } from './PlanoDeContas';
import { ImportacaoRealizado } from './ImportacaoRealizado';
import { RelatorioRealizado } from './RelatorioRealizado';
import { HistoricoUploads } from './HistoricoUploads';
import { Settings, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  schoolId: string;
}

type ConfigTab = 'plano' | 'importacao' | 'historico';

const configTabs: { key: ConfigTab; label: string }[] = [
  { key: 'plano', label: 'Plano de Contas' },
  { key: 'importacao', label: 'Importação' },
  { key: 'historico', label: 'Histórico de Uploads' },
];

export function RealizadoModule({ schoolId }: Props) {
  const [showConfig, setShowConfig] = useState(false);
  const [configTab, setConfigTab] = useState<ConfigTab>('plano');

  if (showConfig) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Button size="sm" variant="ghost" onClick={() => setShowConfig(false)}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Voltar ao Relatório
          </Button>
        </div>
        <div className="flex gap-1 mb-4 border-b border-border/50">
          {configTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setConfigTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
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
        </motion.div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-display font-semibold text-foreground">Análise de Despesas</h2>
        <Button size="sm" variant="outline" onClick={() => setShowConfig(true)}>
          <Settings className="w-4 h-4 mr-1" /> Configurações
        </Button>
      </div>
      <RelatorioRealizado schoolId={schoolId} />
    </div>
  );
}

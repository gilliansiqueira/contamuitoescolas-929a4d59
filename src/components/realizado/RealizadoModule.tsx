import { useState } from 'react';
import { PlanoDeContas } from './PlanoDeContas';
import { ImportacaoRealizado } from './ImportacaoRealizado';
import { RelatorioRealizado } from './RelatorioRealizado';
import { BookOpen, Upload, FileBarChart } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  schoolId: string;
}

type SubTab = 'plano' | 'importacao' | 'relatorio';

const subTabs: { key: SubTab; label: string; icon: any }[] = [
  { key: 'plano', label: 'Plano de Contas', icon: BookOpen },
  { key: 'importacao', label: 'Importação', icon: Upload },
  { key: 'relatorio', label: 'Relatório', icon: FileBarChart },
];

export function RealizadoModule({ schoolId }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('relatorio');

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4 border-b border-border/50">
        {subTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              subTab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <motion.div
        key={subTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        {subTab === 'plano' && <PlanoDeContas schoolId={schoolId} />}
        {subTab === 'importacao' && <ImportacaoRealizado schoolId={schoolId} />}
        {subTab === 'relatorio' && <RelatorioRealizado schoolId={schoolId} />}
      </motion.div>
    </div>
  );
}

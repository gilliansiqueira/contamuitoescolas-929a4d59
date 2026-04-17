import { useState, useCallback, useMemo } from 'react';
import { PlanoDeContas } from './PlanoDeContas';
import { ImportacaoRealizado } from './ImportacaoRealizado';
import { RelatorioRealizado } from './RelatorioRealizado';
import { HistoricoUploads } from './HistoricoUploads';
import { ExportacaoDados } from './ExportacaoDados';
import { ConversaoDashboard } from './ConversaoDashboard';
import { VendasDashboard } from './VendasDashboard';
import { IndicadoresDashboard } from '@/components/indicadores/IndicadoresDashboard';
import { Settings, ChevronLeft, Gauge, ArrowRightLeft, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePresentation } from '@/components/presentation-provider';

interface Props {
  schoolId: string;
}

type ConfigTab = 'plano' | 'importacao' | 'historico' | 'dados';
type MainView = 'relatorio' | 'indicadores' | 'conversao' | 'vendas';

const configTabs: { key: ConfigTab; label: string }[] = [
  { key: 'plano', label: 'Plano de Contas' },
  { key: 'importacao', label: 'Importação' },
  { key: 'historico', label: 'Histórico' },
  { key: 'dados', label: 'Exportar Dados' },
];

interface TabVisibility {
  relatorio: boolean;
  indicadores: boolean;
  conversao: boolean;
  vendas: boolean;
}

function useTabVisibility(schoolId: string) {
  const queryClient = useQueryClient();

  const { data: tabs } = useQuery({
    queryKey: ['module_tabs', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('module_tabs').select('*').eq('school_id', schoolId);
      if (error) throw error;
      return data as { tab_key: string; enabled: boolean }[];
    },
  });

  const visibility = useMemo<TabVisibility>(() => {
    const defaults: TabVisibility = { relatorio: true, indicadores: true, conversao: true, vendas: true };
    if (!tabs) return defaults;
    tabs.forEach(t => {
      if (t.tab_key in defaults) {
        (defaults as any)[t.tab_key] = t.enabled;
      }
    });
    return defaults;
  }, [tabs]);

  const toggle = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const existing = tabs?.find(t => t.tab_key === key);
      if (existing) {
        await supabase.from('module_tabs').update({ enabled }).eq('school_id', schoolId).eq('tab_key', key);
      } else {
        await supabase.from('module_tabs').insert({ school_id: schoolId, tab_key: key, enabled });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['module_tabs', schoolId] }),
  });

  return { visibility, toggle };
}

export function RealizadoModule({ schoolId }: Props) {
  const [showConfig, setShowConfig] = useState(false);
  const [configTab, setConfigTab] = useState<ConfigTab>('importacao');
  const [mainView, setMainView] = useState<MainView>('relatorio');
  const queryClient = useQueryClient();
  const { visibility, toggle } = useTabVisibility(schoolId);
  const { isPresentationMode } = usePresentation();

  // Força sair das configurações se ligar apresentação
  if (isPresentationMode && showConfig) {
    setShowConfig(false);
  }

  const handleBackToReport = useCallback(() => {
    setShowConfig(false);
    queryClient.invalidateQueries({ queryKey: ['realized_entries', schoolId] });
    queryClient.invalidateQueries({ queryKey: ['chart_of_accounts', schoolId] });
  }, [queryClient, schoolId]);

  // If current view is hidden, fallback
  const activeView = useMemo(() => {
    if (mainView === 'conversao' && !visibility.conversao) return 'relatorio';
    if (mainView === 'indicadores' && !visibility.indicadores) return 'relatorio';
    if (mainView === 'vendas' && !visibility.vendas) return 'relatorio';
    return mainView;
  }, [mainView, visibility]);

  if (showConfig) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Button size="sm" variant="ghost" onClick={handleBackToReport} className="rounded-xl">
            <ChevronLeft className="w-4 h-4 mr-1" /> Voltar ao Relatório
          </Button>
        </div>

        {/* Tab visibility toggles */}
        <div className="mb-5 p-4 rounded-2xl border bg-card">
          <h4 className="text-sm font-semibold mb-3">Abas do Relatório Realizado</h4>
          <div className="space-y-2">
            {[
              { key: 'relatorio', label: 'Análise de Despesas', locked: true },
              { key: 'indicadores', label: 'Indicadores' },
              { key: 'conversao', label: 'Conversão' },
              { key: 'vendas', label: 'Vendas' },
            ].map(tab => (
              <label key={tab.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={(visibility as any)[tab.key]}
                  disabled={tab.locked}
                  onChange={e => toggle.mutate({ key: tab.key, enabled: e.target.checked })}
                />
                {tab.label}
                {tab.locked && <span className="text-xs text-muted-foreground">(sempre ativa)</span>}
              </label>
            ))}
          </div>
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
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setMainView('relatorio')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              activeView === 'relatorio'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            Análise de Despesas
          </button>
          {visibility.indicadores && (
            <button
              onClick={() => setMainView('indicadores')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                activeView === 'indicadores'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Gauge className="w-4 h-4" />
              Indicadores
            </button>
          )}
          {visibility.conversao && (
            <button
              onClick={() => setMainView('conversao')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                activeView === 'conversao'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              Conversão
            </button>
          )}
        </div>
        {!isPresentationMode && (
          <Button size="sm" variant="outline" onClick={() => setShowConfig(true)} className="rounded-xl">
            <Settings className="w-4 h-4 mr-1" /> Configurações
          </Button>
        )}
      </div>
      <motion.div key={activeView} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
        {activeView === 'relatorio' && <RelatorioRealizado schoolId={schoolId} />}
        {activeView === 'indicadores' && <IndicadoresDashboard schoolId={schoolId} />}
        {activeView === 'conversao' && <ConversaoDashboard schoolId={schoolId} />}
      </motion.div>
    </div>
  );
}

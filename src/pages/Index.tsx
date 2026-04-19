import { useState, useCallback, useEffect } from 'react';
import { School } from '@/types/financial';
import { SchoolSelector } from '@/components/SchoolSelector';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PresentationToggle } from '@/components/PresentationToggle';
import { usePresentation } from '@/components/presentation-provider';
import { useAuth } from '@/hooks/useAuth';
import { useSchools } from '@/hooks/useFinancialData';
import { Dashboard } from '@/components/Dashboard';
import { FileUpload } from '@/components/FileUpload';
import { CashFlow } from '@/components/CashFlow';
import { Simulation } from '@/components/Simulation';
import { UploadGuide } from '@/components/UploadGuide';
import { ProjectedVsReal } from '@/components/ProjectedVsReal';
import { ExportImport } from '@/components/ExportImport';
import { Receivables } from '@/components/Receivables';
import { FinancialCalendar } from '@/components/FinancialCalendar';
import { DataTable } from '@/components/DataTable';
import { ScenarioView } from '@/components/ScenarioView';
import { MonthSelector } from '@/components/MonthSelector';
import { ScenarioSelector, ScenarioType } from '@/components/ScenarioSelector';
import { UploadHistory } from '@/components/UploadHistory';
import { SaldoInicialConfig } from '@/components/SaldoInicialConfig';
import { TypeClassificationConfig } from '@/components/TypeClassificationConfig';
import { PaymentDelayConfig } from '@/components/PaymentDelayConfig';
import { AuditHistory } from '@/components/AuditHistory';
import { DailyFlowTable } from '@/components/DailyFlowTable';
import { UsersConfig } from '@/components/UsersConfig';
import { Button } from '@/components/ui/button';

import { RealizadoModule } from '@/components/realizado/RealizadoModule';
import {
  LayoutDashboard, BarChart3, Calculator, Settings, CreditCard, ChevronDown,
  CalendarDays, TableProperties, TrendingUp, Table2, FileBarChart, LogOut,
} from 'lucide-react';
import contaMuitoLogo from '@/assets/conta-muito-logo.jpeg';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Tab = 'dashboard' | 'cashflow' | 'receivables' | 'simulation' | 'calendar' | 'datatable' | 'scenarios' | 'upload' | 'guide' | 'export' | 'comparison' | 'uploads_history' | 'saldo_inicial' | 'type_classification' | 'payment_delays' | 'audit_history' | 'daily_flow' | 'users';

type AppModule = 'projecao' | 'realizado';

const mainTabs: { key: Tab; label: string; icon: any }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'daily_flow', label: 'Fluxo Diário', icon: Table2 },
  { key: 'cashflow', label: 'Fluxo', icon: BarChart3 },
  { key: 'receivables', label: 'Recebíveis', icon: CreditCard },
  { key: 'calendar', label: 'Calendário', icon: CalendarDays },
  { key: 'datatable', label: 'Dados', icon: TableProperties },
  { key: 'scenarios', label: 'Cenários', icon: TrendingUp },
  { key: 'simulation', label: 'Simulação', icon: Calculator },
];

const settingsTabsBase: { key: Tab; label: string; adminOnly?: boolean }[] = [
  { key: 'users', label: 'Usuários', adminOnly: true },
  { key: 'saldo_inicial', label: 'Saldo Inicial' },
  { key: 'type_classification', label: 'Classificação de Tipos' },
  { key: 'payment_delays', label: 'Prazos de Cobrança' },
  { key: 'upload', label: 'Upload de Dados' },
  { key: 'uploads_history', label: 'Histórico de Uploads' },
  { key: 'audit_history', label: 'Histórico de Alterações' },
  { key: 'guide', label: 'Guia & Regras' },
  { key: 'export', label: 'Exportar / Importar' },
  { key: 'comparison', label: 'Projetado vs Real' },
];

const Index = () => {
  const { isPresentationMode } = usePresentation();
  const { isAdmin, profile, signOut } = useAuth();
  const { data: allSchools = [] } = useSchools();
  const [school, setSchool] = useState<School | null>(null);
  const [appModule, setAppModule] = useState<AppModule>('projecao');
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [scenario, setScenario] = useState<ScenarioType>('real');

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Filtra abas de configuração conforme papel
  const settingsTabs = settingsTabsBase.filter(t => !t.adminOnly || isAdmin);
  const isSettingsTab = settingsTabs.some(t => t.key === activeTab);

  // Auto-seleção: cliente vai direto para sua única empresa
  useEffect(() => {
    if (!school && !isAdmin && profile?.school_id) {
      const mine = allSchools.find(s => s.id === profile.school_id);
      if (mine) setSchool(mine);
    }
  }, [school, isAdmin, profile?.school_id, allSchools]);

  // Se ativaram o modo apresentação e estamos numa aba de configuração, forçar ida para o dashboard
  if (isPresentationMode && isSettingsTab) {
    setActiveTab('dashboard');
  }

  if (!school) {
    return (
      <div className="min-h-screen bg-background">
        <SchoolSelector selectedSchool={null} onSelect={setSchool} />
      </div>
    );
  }

  const showMonthSelector = ['dashboard', 'cashflow', 'receivables', 'calendar', 'datatable', 'scenarios', 'daily_flow', 'export'].includes(activeTab);
  const showScenarioSelector = activeTab === 'scenarios';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={contaMuitoLogo} alt="Conta Muito" className="h-10 w-auto object-contain" />
            <h1 className="font-display font-bold text-lg hidden sm:block text-foreground">Relatório Financeiro</h1>
          </div>
          <div className="flex items-center gap-3">
            <SchoolSelector selectedSchool={school} onSelect={(s) => {
              if (s?.id === school.id) setSchool(null);
              else setSchool(s);
            }} />
            <PresentationToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Module Selector */}
      <div className="sticky top-[57px] z-45 bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 flex">
          <button
            onClick={() => setAppModule('projecao')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-colors border-b-3 ${
              appModule === 'projecao'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Projeção
          </button>
          <button
            onClick={() => setAppModule('realizado')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-colors border-b-3 ${
              appModule === 'realizado'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileBarChart className="w-4 h-4" />
            Relatório Realizado
          </button>
        </div>
      </div>

      {appModule === 'projecao' ? (
        <>
          {/* Projeção Tabs */}
          <nav className="sticky top-[105px] z-40 bg-card/80 backdrop-blur-md border-b border-border/50 overflow-x-auto">
            <div className="max-w-7xl mx-auto px-4 flex gap-1 items-center">
              {mainTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                    activeTab === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}

              {!isPresentationMode && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ml-auto ${
                      isSettingsTab
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}>
                      <Settings className="w-4 h-4" />
                      <span className="hidden sm:inline">Config</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {settingsTabs.map(t => (
                      <DropdownMenuItem key={t.key} onClick={() => setActiveTab(t.key)}>
                        {t.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </nav>

          {/* Filters bar */}
          {(showMonthSelector || showScenarioSelector) && (
            <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 border-b border-border/30">
              {showMonthSelector && (
                <MonthSelector schoolId={school.id} value={selectedMonth} onChange={setSelectedMonth} />
              )}
              {showScenarioSelector && (
                <ScenarioSelector value={scenario} onChange={setScenario} />
              )}
            </div>
          )}

          {/* Projeção Content */}
          <main className="max-w-7xl mx-auto px-4 py-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeTab}-${refreshKey}-${selectedMonth}-${scenario}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'dashboard' && <Dashboard schoolId={school.id} selectedMonth={selectedMonth} />}
                {activeTab === 'daily_flow' && <DailyFlowTable schoolId={school.id} selectedMonth={selectedMonth} />}
                {activeTab === 'upload' && <FileUpload schoolId={school.id} onImported={refresh} />}
                {activeTab === 'cashflow' && <CashFlow schoolId={school.id} selectedMonth={selectedMonth} />}
                {activeTab === 'receivables' && <Receivables schoolId={school.id} selectedMonth={selectedMonth} />}
                {activeTab === 'calendar' && <FinancialCalendar schoolId={school.id} selectedMonth={selectedMonth} />}
                {activeTab === 'datatable' && <DataTable schoolId={school.id} selectedMonth={selectedMonth} onDataChanged={refresh} />}
                {activeTab === 'scenarios' && <ScenarioView schoolId={school.id} scenario={scenario} selectedMonth={selectedMonth} />}
                {activeTab === 'simulation' && <Simulation schoolId={school.id} />}
                {activeTab === 'guide' && <UploadGuide schoolId={school.id} />}
                {activeTab === 'comparison' && <ProjectedVsReal schoolId={school.id} />}
                {activeTab === 'export' && <ExportImport schoolId={school.id} selectedMonth={selectedMonth} onDataChanged={refresh} />}
                {activeTab === 'uploads_history' && <UploadHistory schoolId={school.id} onDataChanged={refresh} />}
                {activeTab === 'saldo_inicial' && <SaldoInicialConfig schoolId={school.id} onChanged={refresh} />}
                {activeTab === 'type_classification' && <TypeClassificationConfig schoolId={school.id} onChanged={refresh} />}
                {activeTab === 'payment_delays' && <PaymentDelayConfig schoolId={school.id} onChanged={refresh} />}
                {activeTab === 'audit_history' && <AuditHistory schoolId={school.id} />}
                
              </motion.div>
            </AnimatePresence>
          </main>
        </>
      ) : (
        /* Relatório Realizado */
        <main className="max-w-7xl mx-auto px-4 py-6">
          <RealizadoModule schoolId={school.id} />
        </main>
      )}
    </div>
  );
};

export default Index;

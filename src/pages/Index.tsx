import { useState, useCallback } from 'react';
import { School } from '@/types/financial';
import { SchoolSelector } from '@/components/SchoolSelector';
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
import {
  LayoutDashboard, BarChart3, Calculator, Settings, CreditCard, ChevronDown,
  CalendarDays, TableProperties, TrendingUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Tab = 'dashboard' | 'cashflow' | 'receivables' | 'simulation' | 'calendar' | 'datatable' | 'scenarios' | 'upload' | 'guide' | 'export' | 'comparison' | 'uploads_history' | 'saldo_inicial';

const mainTabs: { key: Tab; label: string; icon: any }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'cashflow', label: 'Fluxo', icon: BarChart3 },
  { key: 'receivables', label: 'Recebíveis', icon: CreditCard },
  { key: 'calendar', label: 'Calendário', icon: CalendarDays },
  { key: 'datatable', label: 'Dados', icon: TableProperties },
  { key: 'scenarios', label: 'Cenários', icon: TrendingUp },
  { key: 'simulation', label: 'Simulação', icon: Calculator },
];

const settingsTabs: { key: Tab; label: string }[] = [
  { key: 'saldo_inicial', label: 'Saldo Inicial' },
  { key: 'upload', label: 'Upload de Dados' },
  { key: 'uploads_history', label: 'Histórico de Uploads' },
  { key: 'guide', label: 'Guia & Regras' },
  { key: 'export', label: 'Exportar / Importar' },
  { key: 'comparison', label: 'Projetado vs Real' },
];

const Index = () => {
  const [school, setSchool] = useState<School | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [scenario, setScenario] = useState<ScenarioType>('real');

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const isSettingsTab = settingsTabs.some(t => t.key === activeTab);

  if (!school) {
    return (
      <div className="min-h-screen bg-background">
        <SchoolSelector selectedSchool={null} onSelect={setSchool} />
      </div>
    );
  }

  const showMonthSelector = ['dashboard', 'cashflow', 'receivables', 'calendar', 'datatable', 'scenarios'].includes(activeTab);
  const showScenarioSelector = activeTab === 'scenarios';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg gradient-green flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-primary-foreground" />
            </div>
            <h1 className="font-display font-bold text-lg hidden sm:block text-foreground">Projeção Financeira</h1>
          </div>
          <div className="flex items-center gap-3">
            <SchoolSelector selectedSchool={school} onSelect={(s) => {
              if (s?.id === school.id) setSchool(null);
              else setSchool(s);
            }} />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="sticky top-[57px] z-40 bg-card/80 backdrop-blur-md border-b border-border/50 overflow-x-auto">
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

      {/* Content */}
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
            {activeTab === 'upload' && <FileUpload schoolId={school.id} onImported={refresh} />}
            {activeTab === 'cashflow' && <CashFlow schoolId={school.id} selectedMonth={selectedMonth} />}
            {activeTab === 'receivables' && <Receivables schoolId={school.id} selectedMonth={selectedMonth} />}
            {activeTab === 'calendar' && <FinancialCalendar schoolId={school.id} selectedMonth={selectedMonth} />}
            {activeTab === 'datatable' && <DataTable schoolId={school.id} selectedMonth={selectedMonth} onDataChanged={refresh} />}
            {activeTab === 'scenarios' && <ScenarioView schoolId={school.id} scenario={scenario} selectedMonth={selectedMonth} />}
            {activeTab === 'simulation' && <Simulation schoolId={school.id} />}
            {activeTab === 'guide' && <UploadGuide schoolId={school.id} />}
            {activeTab === 'comparison' && <ProjectedVsReal schoolId={school.id} />}
            {activeTab === 'export' && <ExportImport schoolId={school.id} onDataChanged={refresh} />}
            {activeTab === 'uploads_history' && <UploadHistory schoolId={school.id} onDataChanged={refresh} />}
            {activeTab === 'saldo_inicial' && <SaldoInicialConfig schoolId={school.id} onChanged={refresh} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Index;

import { lazy, Suspense, useState, useCallback, useEffect } from 'react';
import { School } from '@/types/financial';
import { SchoolSelector } from '@/components/SchoolSelector';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PresentationToggle } from '@/components/PresentationToggle';
import { usePresentation } from '@/components/presentation-provider';
import { useAuth } from '@/hooks/useAuth';
import { useSchools } from '@/hooks/useFinancialData';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { DemoBanner } from '@/components/DemoBanner';
import { MonthSelector } from '@/components/MonthSelector';
import { ScenarioSelector } from '@/components/ScenarioSelector';
import type { ScenarioType } from '@/components/ScenarioSelector';
import { ExportPdfSection } from '@/components/ExportPdfSection';
import { Button } from '@/components/ui/button';
import { GlobalPeriodProvider, useGlobalPeriod } from '@/contexts/GlobalPeriodContext';
import { SharedMonthProvider } from '@/components/realizado/SharedMonthContext';

import { RealizadoModule, useRealizadoViews, type MainView as RealizadoView } from '@/components/realizado/RealizadoModule';
import { MobileTabStrip } from '@/components/mobile/MobileTabStrip';
import { MobileNavSheet, type NavSheetSection } from '@/components/mobile/MobileNavSheet';
import {
  LayoutDashboard, BarChart3, Calculator, Settings, CreditCard, ChevronDown,
  CalendarDays, TableProperties, TrendingUp, Table2, FileBarChart, LogOut, MoreHorizontal, Menu as MenuIcon, Database,
} from 'lucide-react';
import contaMuitoLogo from '@/assets/logo-conta-muito.png';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const lazyNamed = <T extends Record<string, unknown>, K extends keyof T>(loader: () => Promise<T>, name: K) =>
  lazy(async () => ({ default: (await loader())[name] as React.ComponentType<any> }));

const Dashboard = lazyNamed(() => import('@/components/Dashboard'), 'Dashboard');
const FileUpload = lazyNamed(() => import('@/components/FileUpload'), 'FileUpload');
const CashFlow = lazyNamed(() => import('@/components/CashFlow'), 'CashFlow');
const Simulation = lazyNamed(() => import('@/components/Simulation'), 'Simulation');
const UploadGuide = lazyNamed(() => import('@/components/UploadGuide'), 'UploadGuide');
const ProjectedVsReal = lazyNamed(() => import('@/components/ProjectedVsReal'), 'ProjectedVsReal');
const ExportImport = lazyNamed(() => import('@/components/ExportImport'), 'ExportImport');
const Receivables = lazyNamed(() => import('@/components/Receivables'), 'Receivables');
const FinancialCalendar = lazyNamed(() => import('@/components/FinancialCalendar'), 'FinancialCalendar');
const DataTable = lazyNamed(() => import('@/components/DataTable'), 'DataTable');
const ComparativoPeriodos = lazyNamed(() => import('@/components/comparativo/ComparativoPeriodos'), 'ComparativoPeriodos');
const ScenarioView = lazyNamed(() => import('@/components/ScenarioView'), 'ScenarioView');
const UploadHistory = lazyNamed(() => import('@/components/UploadHistory'), 'UploadHistory');
const SaldoInicialConfig = lazyNamed(() => import('@/components/SaldoInicialConfig'), 'SaldoInicialConfig');
const PaymentDelayConfig = lazyNamed(() => import('@/components/PaymentDelayConfig'), 'PaymentDelayConfig');
const AuditHistory = lazyNamed(() => import('@/components/AuditHistory'), 'AuditHistory');
const DailyFlowTable = lazyNamed(() => import('@/components/DailyFlowTable'), 'DailyFlowTable');
const UsersConfig = lazyNamed(() => import('@/components/UsersConfig'), 'UsersConfig');
const HistoricoFinanceiroConfig = lazyNamed(() => import('@/components/HistoricoFinanceiroConfig'), 'HistoricoFinanceiroConfig');
const ModelosFinanceirosManager = lazyNamed(() => import('@/components/ModelosFinanceirosManager'), 'ModelosFinanceirosManager');
const EmpresaModeloConfig = lazyNamed(() => import('@/components/EmpresaModeloConfig'), 'EmpresaModeloConfig');
const FluxoBancario = lazyNamed(() => import('@/components/fluxo-bancario/FluxoBancario'), 'FluxoBancario');

const ScreenLoading = () => (
  <div className="min-h-48 flex items-center justify-center text-sm text-muted-foreground">Carregando dados…</div>
);

type Tab = 'dashboard' | 'cashflow' | 'receivables' | 'simulation' | 'calendar' | 'datatable' | 'comparativo_periodos' | 'scenarios' | 'upload' | 'guide' | 'export' | 'comparison' | 'uploads_history' | 'saldo_inicial' | 'payment_delays' | 'audit_history' | 'daily_flow' | 'users' | 'historico_financeiro' | 'modelos_financeiros' | 'empresa_modelo' | 'bank_flow';

type AppModule = 'projecao' | 'realizado';

const mainTabs: { key: Tab; label: string; icon: any; adminOnly?: boolean; pilotOnly?: boolean }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'daily_flow', label: 'Fluxo Diário', icon: Table2 },
  { key: 'receivables', label: 'Recebíveis', icon: CreditCard },
  { key: 'calendar', label: 'Calendário', icon: CalendarDays },
  { key: 'comparativo_periodos', label: 'Comparativo', icon: TableProperties },
  { key: 'scenarios', label: 'Cenários', icon: TrendingUp },
  { key: 'simulation', label: 'Simulação', icon: Calculator },
  { key: 'datatable', label: 'Dados', icon: Database, adminOnly: true },
  { key: 'bank_flow', label: 'Fluxo Bancário', icon: Landmark, adminOnly: true, pilotOnly: true },
];

const settingsTabsBase: { key: Tab; label: string; adminOnly?: boolean }[] = [
  { key: 'users', label: 'Usuários', adminOnly: true },
  { key: 'saldo_inicial', label: 'Saldo Inicial' },
  { key: 'empresa_modelo', label: 'Modelo da Empresa' },
  { key: 'modelos_financeiros', label: 'Modelos Financeiros (Templates)', adminOnly: true },
  { key: 'historico_financeiro', label: 'Histórico Financeiro' },
  { key: 'payment_delays', label: 'Prazos de Cobrança' },
  { key: 'upload', label: 'Upload de Dados' },
  { key: 'uploads_history', label: 'Histórico de Uploads' },
  { key: 'audit_history', label: 'Histórico de Alterações' },
  { key: 'guide', label: 'Guia & Regras' },
  { key: 'export', label: 'Exportar / Importar' },
  { key: 'comparison', label: 'Projetado vs Real' },
  { key: 'datatable', label: 'Dados (tabela bruta)', adminOnly: true },
];

const Index = () => {
  const { isPresentationMode } = usePresentation();
  const { isDemo, demoSchoolId } = useDemoMode();
  const { isAdmin: realIsAdmin, isAdminAll, profile, accessibleSchoolIds, signOut } = useAuth();
  const isAdmin = isDemo ? false : realIsAdmin;
  const { data: allSchools = [], isError: schoolsError, isFetching: schoolsFetching, refetch: refetchSchools } = useSchools();
  const [school, setSchool] = useState<School | null>(null);

  // Auto-select demo school
  useEffect(() => {
    if (isDemo && !school) {
      const demo = allSchools.find(s => s.id === demoSchoolId);
      if (demo) setSchool(demo);
    }
  }, [isDemo, demoSchoolId, allSchools, school]);

  useEffect(() => {
    if (isDemo || school || isAdminAll) return;
    if (accessibleSchoolIds.length === 1) {
      const mine = allSchools.find(s => s.id === accessibleSchoolIds[0]);
      if (mine) setSchool(mine);
    }
  }, [isDemo, school, isAdminAll, accessibleSchoolIds, allSchools]);

  if (!school) {
    return (
      <div className="min-h-screen bg-background">
        {isDemo && <DemoBanner />}
        {isDemo ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center text-muted-foreground">
            {schoolsError || (!schoolsFetching && allSchools.length === 0) ? (
              <>
                <p className="max-w-md text-sm">
                  Não conseguimos carregar a demonstração agora. Verifique sua conexão e tente novamente.
                </p>
                <Button onClick={() => refetchSchools()} disabled={schoolsFetching}>
                  {schoolsFetching ? 'Tentando…' : 'Tentar novamente'}
                </Button>
              </>
            ) : (
              <span>Carregando demonstração...</span>
            )}
          </div>
        ) : (
          <SchoolSelector selectedSchool={null} onSelect={setSchool} />
        )}
      </div>
    );
  }

  return (
    <GlobalPeriodProvider schoolId={school.id} key={school.id}>
      <SharedMonthProvider>
        <IndexBody
          school={school}
          setSchool={setSchool}
          isAdmin={isAdmin}
          isAdminAll={isAdminAll}
          accessibleSchoolIds={accessibleSchoolIds}
          profile={profile}
          signOut={signOut}
          isDemo={isDemo}
          isPresentationMode={isPresentationMode}
        />
      </SharedMonthProvider>
    </GlobalPeriodProvider>
  );
};

interface IndexBodyProps {
  school: School;
  setSchool: (s: School | null) => void;
  isAdmin: boolean;
  isAdminAll: boolean;
  accessibleSchoolIds: string[];
  profile: any;
  signOut: () => void;
  isDemo: boolean;
  isPresentationMode: boolean;
}

function IndexBody({
  school, setSchool, isAdmin, isAdminAll, accessibleSchoolIds, profile, signOut, isDemo, isPresentationMode,
}: IndexBodyProps) {
  const [appModule, setAppModule] = useState<AppModule>('projecao');
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [realizadoView, setRealizadoView] = useState<RealizadoView>('relatorio');
  const [navOpen, setNavOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scenario, setScenario] = useState<ScenarioType>('real');
  const period = useGlobalPeriod();
  const selectedMonth = period.value; // fonte única
  const realizadoViews = useRealizadoViews(school.id);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const settingsTabs = settingsTabsBase.filter(t => !t.adminOnly || isAdmin);
  const isSettingsTab = settingsTabs.some(t => t.key === activeTab);
  const canSeeAdminTabs = isAdmin && !isPresentationMode && !isDemo;
  const { data: bankPilotEnabled = false } = useSchoolFeature(school.id, BANK_PILOT_FEATURE, canSeeAdminTabs);
  const visibleMainTabs = mainTabs.filter(t => (!t.adminOnly || canSeeAdminTabs) && (!t.pilotOnly || bankPilotEnabled));

  if ((isPresentationMode || isDemo) && isSettingsTab) {
    setActiveTab('dashboard');
  }

  if (!canSeeAdminTabs && mainTabs.some(t => t.key === activeTab && t.adminOnly)) {
    setActiveTab('dashboard');
  }

  if (activeTab === 'bank_flow' && !bankPilotEnabled) {
    setActiveTab('dashboard');
  }

  const showScenarioSelector = activeTab === 'scenarios';

  const navSections: NavSheetSection[] = [
    {
      title: 'Projeção',
      items: visibleMainTabs.map(t => ({
        key: `p-${t.key}`,
        label: t.label,
        icon: t.icon,
        active: appModule === 'projecao' && activeTab === t.key,
        onSelect: () => { setAppModule('projecao'); setActiveTab(t.key); },
      })),
    },
    {
      title: 'Relatório Realizado',
      items: realizadoViews.map(v => ({
        key: `r-${v.key}`,
        label: v.label,
        icon: v.icon,
        active: appModule === 'realizado' && realizadoView === v.key,
        onSelect: () => { setAppModule('realizado'); setRealizadoView(v.key); },
      })),
    },
    {
      title: 'Configurações',
      items: (!isPresentationMode && isAdmin ? settingsTabs : []).map(t => ({
        key: `s-${t.key}`,
        label: t.label,
        icon: Settings,
        active: appModule === 'projecao' && activeTab === t.key,
        onSelect: () => { setAppModule('projecao'); setActiveTab(t.key); },
      })),
    },
  ];

  const currentTabLabel = mainTabs.find(t => t.key === activeTab)?.label
    ?? settingsTabs.find(t => t.key === activeTab)?.label
    ?? '';

  return (
    <div className="min-h-screen bg-background">
      {isDemo && <DemoBanner />}
      {/* Header */}
      <header className="app-shell-header sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <img src={contaMuitoLogo} alt="Conta Muito" className="h-7 sm:h-10 w-auto object-contain" />
            <div className="hidden border-l border-border pl-3 sm:block">
              <p className="font-editorial text-xl leading-none text-foreground">Visão financeira</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Decisões claras</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {isDemo ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium">
                {school.nome}
              </div>
            ) : (
              <SchoolSelector selectedSchool={school} onSelect={(s) => {
                if (!isAdminAll && accessibleSchoolIds.length < 2) return;
                if (s?.id === school.id) setSchool(null);
                else setSchool(s);
              }} />
            )}
            {/* Filtro GLOBAL de período — controla todas as abas */}
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/5 border border-primary/20" title="Período aplicado em todas as abas">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Período</span>
              <MonthSelector schoolId={school.id} value={period.value} onChange={period.setValue} />
            </div>
            <PresentationToggle />
            <ThemeToggle />
            {!isDemo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                title={profile?.email}
                className="text-muted-foreground hover:text-destructive"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline ml-1">Sair</span>
              </Button>
            )}
          </div>
        </div>
        {/* Filtro global mobile */}
        <div className="sm:hidden px-4 pb-2 flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Período</span>
          <MonthSelector schoolId={school.id} value={period.value} onChange={period.setValue} />
        </div>
      </header>

      {/* Module Selector */}
      <div className="app-module-rail sticky top-[49px] z-45 border-b border-border sm:top-[57px]">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 flex">
          <button
            onClick={() => setAppModule('projecao')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition-colors border-b-3 ${
              appModule === 'projecao'
                ? 'border-primary text-primary bg-primary/10'
                : 'app-module-button-inactive border-transparent hover:text-background'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Projeção
          </button>
          <button
            onClick={() => setAppModule('realizado')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition-colors border-b-3 ${
              appModule === 'realizado'
                ? 'border-primary text-primary bg-primary/10'
                : 'app-module-button-inactive border-transparent hover:text-background'
            }`}
          >
            <FileBarChart className="w-4 h-4" />
            <span className="sm:hidden">Realizado</span>
            <span className="hidden sm:inline">Relatório Realizado</span>
          </button>
        </div>
      </div>

      {appModule === 'projecao' ? (
        <>
          {/* Projeção Tabs */}
          <nav className="sticky top-[105px] z-40 hidden overflow-x-auto border-b border-border/50 bg-card/95 backdrop-blur-md sm:block">
            <div className="max-w-7xl mx-auto px-4 flex gap-1 items-center">
              {visibleMainTabs.map(tab => (
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

              {!isPresentationMode && isAdmin && (
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

          {/* Mobile: faixa deslizável de subabas da Projeção */}
          <div className="sm:hidden border-b border-border/60 bg-card">
            <MobileTabStrip
              items={visibleMainTabs.map(t => ({ key: t.key, label: t.label, icon: t.icon }))}
              active={activeTab}
              onChange={(k) => setActiveTab(k as Tab)}
            />
          </div>

          {/* Filtros específicos (cenário) — o mês agora é global (no header) */}
          {showScenarioSelector && (
            <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 border-b border-border/30">
              <ScenarioSelector value={scenario} onChange={setScenario} />
            </div>
          )}

          {/* Projeção Content */}
          <main className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-6 pb-28 sm:pb-6">
            <h2 className="sm:hidden text-sm font-display font-bold mb-3 truncate">{currentTabLabel}</h2>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeTab}-${refreshKey}-${selectedMonth}-${scenario}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <Suspense fallback={<ScreenLoading />}>
                {activeTab === 'dashboard' && <Dashboard schoolId={school.id} selectedMonth={selectedMonth} />}
                {activeTab === 'daily_flow' && (
                  <ExportPdfSection fileName={`fluxo-diario-${selectedMonth}`}>
                    <DailyFlowTable schoolId={school.id} selectedMonth={selectedMonth} />
                  </ExportPdfSection>
                )}
                {activeTab === 'upload' && <FileUpload schoolId={school.id} onImported={refresh} />}
                {activeTab === 'cashflow' && <CashFlow schoolId={school.id} selectedMonth={selectedMonth} />}
                {activeTab === 'receivables' && (
                  <ExportPdfSection fileName={`recebiveis-${selectedMonth}`}>
                    <Receivables schoolId={school.id} selectedMonth={selectedMonth} />
                  </ExportPdfSection>
                )}
                {activeTab === 'calendar' && (
                  <ExportPdfSection fileName={`calendario-${selectedMonth}`}>
                    <FinancialCalendar schoolId={school.id} selectedMonth={selectedMonth} />
                  </ExportPdfSection>
                )}
                {activeTab === 'datatable' && (
                  <ExportPdfSection fileName={`dados-${selectedMonth}`}>
                    <DataTable schoolId={school.id} selectedMonth={selectedMonth} onDataChanged={refresh} />
                  </ExportPdfSection>
                )}
                {activeTab === 'comparativo_periodos' && (
                  <ExportPdfSection fileName="comparativo-periodos">
                    <ComparativoPeriodos schoolId={school.id} />
                  </ExportPdfSection>
                )}
                {activeTab === 'scenarios' && (
                  <ExportPdfSection fileName={`cenarios-${selectedMonth}`}>
                    <ScenarioView schoolId={school.id} scenario={scenario} selectedMonth={selectedMonth} />
                  </ExportPdfSection>
                )}
                {activeTab === 'simulation' && (
                  <ExportPdfSection fileName="simulacao">
                    <Simulation schoolId={school.id} />
                  </ExportPdfSection>
                )}
                {activeTab === 'guide' && <UploadGuide schoolId={school.id} />}
                {activeTab === 'comparison' && (
                  <ExportPdfSection fileName="projetado-vs-real">
                    <ProjectedVsReal schoolId={school.id} />
                  </ExportPdfSection>
                )}
                {activeTab === 'export' && <ExportImport schoolId={school.id} selectedMonth={selectedMonth} onDataChanged={refresh} />}
                {activeTab === 'uploads_history' && <UploadHistory schoolId={school.id} onDataChanged={refresh} />}
                {activeTab === 'saldo_inicial' && <SaldoInicialConfig schoolId={school.id} onChanged={refresh} />}
                
                {activeTab === 'payment_delays' && <PaymentDelayConfig schoolId={school.id} onChanged={refresh} />}
                {activeTab === 'audit_history' && <AuditHistory schoolId={school.id} />}
                {activeTab === 'users' && <UsersConfig />}
                {activeTab === 'historico_financeiro' && <HistoricoFinanceiroConfig schoolId={school.id} onChanged={refresh} />}
                {activeTab === 'modelos_financeiros' && <ModelosFinanceirosManager />}
                {activeTab === 'empresa_modelo' && <EmpresaModeloConfig schoolId={school.id} onChanged={refresh} />}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </main>
        </>
      ) : (
        /* Relatório Realizado */
        <main className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-6 pb-28 sm:pb-6">
          <RealizadoModule schoolId={school.id} view={realizadoView} onViewChange={setRealizadoView} />
        </main>
      )}

      {/* Navegação mobile — barra inferior (vale nos dois módulos) */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around">
          <button
            onClick={() => setAppModule('projecao')}
            className={`flex-1 min-h-[52px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
              appModule === 'projecao' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <TrendingUp className="w-[18px] h-[18px]" />
            Projeção
          </button>
          <button
            onClick={() => setAppModule('realizado')}
            className={`flex-1 min-h-[52px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
              appModule === 'realizado' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <FileBarChart className="w-[18px] h-[18px]" />
            Realizado
          </button>
          <button
            onClick={() => {
              if (appModule === 'projecao') setActiveTab('dashboard');
              else setRealizadoView('relatorio');
            }}
            className="flex-1 min-h-[52px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-muted-foreground"
          >
            <LayoutDashboard className="w-[18px] h-[18px]" />
            Início
          </button>
          <button
            onClick={() => setNavOpen(true)}
            className={`flex-1 min-h-[52px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
              navOpen ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <MenuIcon className="w-[18px] h-[18px]" />
            Menu
          </button>
        </div>
      </nav>

      <MobileNavSheet open={navOpen} onOpenChange={setNavOpen} sections={navSections} />
    </div>
  );
}

export default Index;

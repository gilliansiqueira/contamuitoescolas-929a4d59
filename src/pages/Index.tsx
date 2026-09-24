import { lazy, Suspense, useState, useCallback, useEffect } from 'react';
import { School } from '@/types/financial';
import { usePresentation } from '@/components/presentation-provider';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolFeature, BANK_PILOT_FEATURE } from '@/hooks/useBankPilot';
import { useSchools } from '@/hooks/useFinancialData';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { DemoBanner } from '@/components/DemoBanner';
import { ScenarioSelector } from '@/components/ScenarioSelector';
import type { ScenarioType } from '@/components/ScenarioSelector';
import { ExportPdfSection } from '@/components/ExportPdfSection';
import { GlobalPeriodProvider, useGlobalPeriod } from '@/contexts/GlobalPeriodContext';
import { SharedMonthProvider } from '@/components/realizado/SharedMonthContext';

import { RealizadoModule, useRealizadoViews, type MainView as RealizadoView } from '@/components/realizado/RealizadoModule';
import { MobileNavSheet, type NavSheetSection } from '@/components/mobile/MobileNavSheet';
import { AppSidebar, type SidebarGroup } from '@/components/app-shell/AppSidebar';
import { AppHeader } from '@/components/app-shell/AppHeader';
import { SchoolSelector } from '@/components/SchoolSelector';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, BarChart3, Calculator, Settings, CreditCard,
  CalendarDays, TableProperties, TrendingUp, Table2, Database, Landmark,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

const SIDEBAR_COLLAPSED_KEY = 'cm-sidebar-collapsed';

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'; } catch { return false; }
  });
  const period = useGlobalPeriod();
  const selectedMonth = period.value; // fonte única
  const realizadoViews = useRealizadoViews(school.id);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

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

  const goProjecao = (tab: Tab) => { setAppModule('projecao'); setActiveTab(tab); };
  const goRealizado = (view: RealizadoView) => { setAppModule('realizado'); setRealizadoView(view); };

  const projItem = (tab: Tab) => {
    const def = mainTabs.find(t => t.key === tab)!;
    return {
      key: `p-${tab}`,
      label: def.label,
      icon: def.icon,
      active: appModule === 'projecao' && activeTab === tab,
      onSelect: () => goProjecao(tab),
    };
  };
  const settingsItem = (tab: Tab) => {
    const def = settingsTabsBase.find(t => t.key === tab)!;
    return {
      key: `s-${tab}`,
      label: def.label,
      icon: Settings,
      active: appModule === 'projecao' && activeTab === tab,
      onSelect: () => goProjecao(tab),
    };
  };
  const realItem = (view: RealizadoView) => {
    const def = realizadoViews.find(v => v.key === view);
    if (!def) return null;
    return {
      key: `r-${view}`,
      label: def.label,
      icon: def.icon,
      active: appModule === 'realizado' && realizadoView === view,
      onSelect: () => goRealizado(view),
    };
  };

  // ===== Agrupamento do novo menu lateral =====
  const sidebarGroups: SidebarGroup[] = [
    {
      key: 'visao-geral',
      title: 'Visão Geral',
      items: [projItem('dashboard')],
    },
    {
      key: 'caixa-projecao',
      title: 'Caixa e Projeção',
      items: (['daily_flow', 'receivables', 'calendar', 'comparativo_periodos', 'scenarios', 'simulation'] as Tab[])
        .filter(t => visibleMainTabs.some(v => v.key === t))
        .map(projItem),
    },
    {
      key: 'resultados',
      title: 'Resultados',
      items: (['relatorio', 'indicadores', 'recebimento_categoria', 'teto_gastos', 'detalhamento'] as RealizadoView[])
        .map(realItem)
        .filter(Boolean) as SidebarGroup['items'],
    },
    {
      key: 'comercial',
      title: 'Comercial',
      items: (['conversao', 'vendas', 'analise_vendas'] as RealizadoView[])
        .map(realItem)
        .filter(Boolean) as SidebarGroup['items'],
    },
    {
      key: 'relatorios',
      title: 'Relatórios',
      items: (['export', 'comparison'] as Tab[])
        .filter(t => settingsTabs.some(s => s.key === t))
        .map(settingsItem),
    },
    {
      key: 'operacao',
      title: 'Operação',
      items: canSeeAdminTabs
        ? [
            ...(['datatable'] as Tab[]).filter(t => visibleMainTabs.some(v => v.key === t)).map(projItem),
            ...(['bank_flow'] as Tab[]).filter(t => visibleMainTabs.some(v => v.key === t)).map(projItem),
            ...(['upload', 'uploads_history', 'audit_history'] as Tab[])
              .filter(t => settingsTabs.some(s => s.key === t))
              .map(settingsItem),
          ]
        : [],
    },
  ].filter(g => g.items.length > 0);

  const configKeys: Tab[] = ['users', 'saldo_inicial', 'empresa_modelo', 'modelos_financeiros', 'historico_financeiro', 'payment_delays', 'guide'];
  const footerGroup: SidebarGroup | null = (!isPresentationMode && isAdmin)
    ? {
        key: 'configuracoes',
        title: 'Configurações',
        items: configKeys.filter(t => settingsTabs.some(s => s.key === t)).map(settingsItem),
      }
    : null;

  // Navegação mobile (folha inferior) — mesmos grupos do menu lateral
  const navSections: NavSheetSection[] = [
    ...sidebarGroups.map(g => ({
      title: g.title,
      items: g.items.map(i => ({ key: i.key, label: i.label, icon: i.icon, active: i.active, onSelect: i.onSelect })),
    })),
    ...(footerGroup ? [{
      title: footerGroup.title,
      items: footerGroup.items.map(i => ({ key: i.key, label: i.label, icon: i.icon, active: i.active, onSelect: i.onSelect })),
    }] : []),
  ];

  const currentTabLabel = appModule === 'realizado'
    ? (realizadoViews.find(v => v.key === realizadoView)?.label ?? '')
    : (mainTabs.find(t => t.key === activeTab)?.label
      ?? settingsTabs.find(t => t.key === activeTab)?.label
      ?? '');

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar groups={sidebarGroups} collapsed={sidebarCollapsed} footerGroup={footerGroup} />

      <div className="flex-1 flex flex-col min-w-0">
        {isDemo && <DemoBanner />}
        <AppHeader
          school={school}
          isDemo={isDemo}
          isAdminAll={isAdminAll}
          accessibleSchoolIds={accessibleSchoolIds}
          profileEmail={profile?.email}
          onSelectSchool={(s) => {
            if (s?.id === school.id) setSchool(null);
            else setSchool(s);
          }}
          onSignOut={signOut}
          periodValue={period.value}
          onPeriodChange={period.setValue}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebar}
          onOpenMobileNav={() => setNavOpen(true)}
        />

        {appModule === 'projecao' ? (
          <>
            {/* Filtros específicos (cenário) — o mês agora é global (no header) */}
            {showScenarioSelector && (
              <div className="max-w-7xl w-full mx-auto px-4 py-3 flex flex-wrap items-center gap-3 border-b border-border/30">
                <ScenarioSelector value={scenario} onChange={setScenario} />
              </div>
            )}

            {/* Projeção Content */}
            <main className="max-w-7xl w-full mx-auto px-3 sm:px-4 py-3 sm:py-6">
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
                  {activeTab === 'bank_flow' && bankPilotEnabled && canSeeAdminTabs && (
                    <FluxoBancario schoolId={school.id} selectedMonth={selectedMonth} />
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
          <main className="max-w-7xl w-full mx-auto px-3 sm:px-4 py-3 sm:py-6">
            <RealizadoModule schoolId={school.id} view={realizadoView} onViewChange={setRealizadoView} />
          </main>
        )}
      </div>

      <MobileNavSheet open={navOpen} onOpenChange={setNavOpen} sections={navSections} />
    </div>
  );
}

export default Index;

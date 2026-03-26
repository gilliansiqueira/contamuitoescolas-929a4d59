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
import {
  LayoutDashboard, BarChart3, Calculator, GitCompare, Settings, CreditCard, Building2, ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Tab = 'dashboard' | 'cashflow' | 'receivables' | 'comparison' | 'simulation' | 'upload' | 'guide' | 'export';

const mainTabs: { key: Tab; label: string; icon: any }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'cashflow', label: 'Fluxo de Caixa', icon: BarChart3 },
  { key: 'receivables', label: 'Recebíveis', icon: CreditCard },
  { key: 'comparison', label: 'Proj. vs Real', icon: GitCompare },
  { key: 'simulation', label: 'Simulação', icon: Calculator },
];

const settingsTabs: { key: Tab; label: string }[] = [
  { key: 'upload', label: 'Upload de Dados' },
  { key: 'guide', label: 'Guia & Regras' },
  { key: 'export', label: 'Exportar / Importar' },
];

const Index = () => {
  const [school, setSchool] = useState<School | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const isSettingsTab = settingsTabs.some(t => t.key === activeTab);

  if (!school) {
    return (
      <div className="min-h-screen bg-background">
        <SchoolSelector selectedSchool={null} onSelect={setSchool} />
      </div>
    );
  }

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
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}

          {/* Settings dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ml-auto ${
                isSettingsTab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Configurações</span>
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

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeTab}-${refreshKey}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <Dashboard schoolId={school.id} />}
            {activeTab === 'upload' && <FileUpload schoolId={school.id} onImported={refresh} />}
            {activeTab === 'cashflow' && <CashFlow schoolId={school.id} />}
            {activeTab === 'receivables' && <Receivables schoolId={school.id} />}
            {activeTab === 'simulation' && <Simulation schoolId={school.id} />}
            {activeTab === 'guide' && <UploadGuide schoolId={school.id} />}
            {activeTab === 'comparison' && <ProjectedVsReal schoolId={school.id} />}
            {activeTab === 'export' && <ExportImport schoolId={school.id} onDataChanged={refresh} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Index;

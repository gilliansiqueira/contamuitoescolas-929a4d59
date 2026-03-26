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
import {
  LayoutDashboard, Upload, BarChart3, Calculator, BookOpen, GitCompare, Download, Building2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Tab = 'dashboard' | 'upload' | 'cashflow' | 'simulation' | 'guide' | 'comparison' | 'export';

const tabs: { key: Tab; label: string; icon: any }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'upload', label: 'Upload', icon: Upload },
  { key: 'cashflow', label: 'Fluxo de Caixa', icon: BarChart3 },
  { key: 'comparison', label: 'Proj. vs Real', icon: GitCompare },
  { key: 'simulation', label: 'Simulação', icon: Calculator },
  { key: 'guide', label: 'Guia & Regras', icon: BookOpen },
  { key: 'export', label: 'Exportar', icon: Download },
];

const Index = () => {
  const [school, setSchool] = useState<School | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  if (!school) {
    return (
      <div className="dark gradient-dark min-h-screen">
        <SchoolSelector selectedSchool={null} onSelect={setSchool} />
      </div>
    );
  }

  return (
    <div className="dark gradient-dark min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg gradient-green flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-primary-foreground" />
            </div>
            <h1 className="font-display font-bold text-lg hidden sm:block">Projeção Financeira</h1>
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
      <nav className="sticky top-[57px] z-40 bg-background/60 backdrop-blur-xl border-b border-border/30 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 flex gap-1">
          {tabs.map(tab => (
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

import { LogOut, Menu as MenuIcon, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SchoolSelector } from '@/components/SchoolSelector';
import { MonthSelector } from '@/components/MonthSelector';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PresentationToggle } from '@/components/PresentationToggle';
import type { School } from '@/types/financial';

interface Props {
  school: School;
  isDemo: boolean;
  isAdminAll: boolean;
  accessibleSchoolIds: string[];
  profileEmail?: string;
  onSelectSchool: (s: School | null) => void;
  onSignOut: () => void;
  periodValue: string;
  onPeriodChange: (v: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenMobileNav: () => void;
}

/** Cabeçalho limpo da nova moldura: empresa, período, tema, apresentação e sair. */
export function AppHeader({
  school, isDemo, isAdminAll, accessibleSchoolIds, profileEmail,
  onSelectSchool, onSignOut, periodValue, onPeriodChange,
  collapsed, onToggleCollapsed, onOpenMobileNav,
}: Props) {
  return (
    <header className="app-shell-header sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md">
      <div className="px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden w-9 h-9"
            onClick={onOpenMobileNav}
            aria-label="Abrir menu"
          >
            <MenuIcon className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden sm:inline-flex w-9 h-9"
            onClick={onToggleCollapsed}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </Button>
          {isDemo ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium">
              {school.nome}
            </div>
          ) : (
            <SchoolSelector selectedSchool={school} onSelect={(s) => {
              if (!isAdminAll && accessibleSchoolIds.length < 2) return;
              onSelectSchool(s);
            }} />
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div
            className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/5 border border-primary/20"
            title="Período aplicado em todas as abas"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Período</span>
            <MonthSelector schoolId={school.id} value={periodValue} onChange={onPeriodChange} />
          </div>
          <PresentationToggle />
          <ThemeToggle />
          {!isDemo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSignOut}
              title={profileEmail}
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
        <MonthSelector schoolId={school.id} value={periodValue} onChange={onPeriodChange} />
      </div>
    </header>
  );
}

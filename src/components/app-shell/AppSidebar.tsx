import { useEffect, useState } from 'react';
import { ChevronDown, Settings } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import contaMuitoLogo from '@/assets/logo-conta-muito.png';

export interface SidebarItem {
  key: string;
  label: string;
  icon?: any;
  active?: boolean;
  onSelect: () => void;
}

export interface SidebarGroup {
  key: string;
  title: string;
  items: SidebarItem[];
}

interface Props {
  groups: SidebarGroup[];
  collapsed: boolean;
  /** Grupo fixado no rodapé (Configurações) */
  footerGroup?: SidebarGroup | null;
}

/** Menu lateral laranja da plataforma. Apenas apresentação/navegação. */
export function AppSidebar({ groups, collapsed, footerGroup }: Props) {
  const activeGroupKey = groups.find(g => g.items.some(i => i.active))?.key
    ?? (footerGroup?.items.some(i => i.active) ? footerGroup.key : null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (activeGroupKey) {
      setOpenGroups(prev => ({ ...prev, [activeGroupKey]: true }));
    }
  }, [activeGroupKey]);

  const toggleGroup = (key: string) =>
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));

  const renderItem = (item: SidebarItem) => {
    const Icon = item.icon;
    const btn = (
      <button
        key={item.key}
        onClick={item.onSelect}
        title={collapsed ? item.label : undefined}
        className={`app-sidebar-item w-full flex items-center gap-3 rounded-lg text-sm transition-colors ${
          collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'
        } ${item.active ? 'app-sidebar-item-active font-semibold shadow-sm' : ''}`}
      >
        {Icon && <Icon className="w-5 h-5 shrink-0" />}
        {!collapsed && <span className="truncate">{item.label}</span>}
      </button>
    );
    if (!collapsed) return btn;
    return (
      <Tooltip key={item.key} delayDuration={150}>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  };

  const renderGroup = (group: SidebarGroup) => {
    if (group.items.length === 0) return null;
    const isOpen = collapsed || openGroups[group.key] !== false;
    const hasActive = group.items.some(i => i.active);
    return (
      <div key={group.key}>
        {!collapsed && (
          <button
            onClick={() => toggleGroup(group.key)}
            className="app-sidebar-group-label w-full flex items-center justify-between px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors"
          >
            <span className="truncate">{group.title}</span>
            <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
          </button>
        )}
        {collapsed && <div className="app-sidebar-divider border-t mx-2 my-2" />}
        {isOpen && <div className="space-y-0.5">{group.items.map(renderItem)}</div>}
        {!isOpen && hasActive && (
          <div className="px-3 pb-1">{group.items.filter(i => i.active).map(renderItem)}</div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={`app-sidebar hidden sm:flex flex-col shrink-0 sticky top-0 h-screen transition-[width] duration-200 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className={`flex items-center gap-3 ${collapsed ? 'justify-center p-4' : 'p-5'}`}>
        <img
          src={contaMuitoLogo}
          alt="Conta Muito"
          className={`object-contain brightness-0 invert ${collapsed ? 'h-8 w-8' : 'h-9 w-auto'}`}
        />
      </div>

      <nav className={`flex-1 overflow-y-auto space-y-5 pb-4 ${collapsed ? 'px-2' : 'px-3'}`}>
        {groups.map(renderGroup)}
      </nav>

      {footerGroup && footerGroup.items.length > 0 && (
        <div className={`app-sidebar-divider border-t p-3 ${collapsed ? 'px-2' : ''}`}>
          {!collapsed && (
            <p className="app-sidebar-group-label px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest">
              {footerGroup.title}
            </p>
          )}
          <div className="space-y-0.5">{footerGroup.items.map(renderItem)}</div>
        </div>
      )}
    </aside>
  );
}

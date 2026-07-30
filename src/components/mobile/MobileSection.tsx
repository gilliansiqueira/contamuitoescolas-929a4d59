import { ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface MobileSectionProps {
  title: ReactNode;
  /** Valor/resumo exibido à direita do título (apenas mobile) */
  summary?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  /** Começa aberta no mobile */
  defaultOpen?: boolean;
  /** No desktop renderiza sem acordeão (só o conteúdo) */
  plainOnDesktop?: boolean;
  className?: string;
}

/**
 * Seção que vira acordeão compacto no mobile e permanece plana no desktop.
 * Puramente de apresentação — nenhuma regra de negócio.
 */
export function MobileSection({
  title, summary, icon, children, defaultOpen = false, plainOnDesktop = true, className = '',
}: MobileSectionProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(defaultOpen);

  if (!isMobile && plainOnDesktop) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={`glass-card rounded-xl overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left active:bg-muted/40"
      >
        <span className="flex items-center gap-2 min-w-0">
          {icon}
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
            {title}
          </span>
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          {summary && <span className="text-xs font-semibold text-foreground">{summary}</span>}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  );
}

import { useEffect, useRef } from 'react';

export interface StripItem {
  key: string;
  label: string;
  icon?: any;
}

interface Props {
  items: StripItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

/**
 * Faixa horizontal de "pílulas" para navegar entre subabas no mobile.
 * Puramente de apresentação — nenhuma regra de negócio.
 */
export function MobileTabStrip({ items, active, onChange, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [active]);

  if (items.length <= 1) return null;

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="flex gap-1.5 overflow-x-auto scrollbar-none px-3 py-2 snap-x"
        style={{ scrollbarWidth: 'none' }}
      >
        {items.map(item => {
          const isActive = item.key === active;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              ref={isActive ? activeRef : undefined}
              onClick={() => onChange(item.key)}
              className={`snap-start shrink-0 min-h-[40px] flex items-center gap-1.5 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
                isActive
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 text-muted-foreground border-transparent active:bg-muted'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {item.label}
            </button>
          );
        })}
        <span className="shrink-0 w-2" aria-hidden />
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-7 bg-gradient-to-l from-card to-transparent" />
    </div>
  );
}

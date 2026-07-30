import { ReactNode } from 'react';

interface CompactStatProps {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  valueClassName?: string;
  hint?: ReactNode;
}

/** Card de métrica compacto (altura reduzida) usado no layout mobile. */
export function CompactStat({ label, value, icon, badge, valueClassName = '', hint }: CompactStatProps) {
  return (
    <div className="glass-card rounded-lg px-2.5 py-2 min-w-0">
      <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
        {icon}
        <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground truncate">
          {label}
        </span>
        {badge}
      </div>
      <p className={`text-[15px] leading-tight font-display font-bold truncate ${valueClassName}`}>{value}</p>
      {hint && <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
    </div>
  );
}

/** Grade de 2 colunas para métricas no mobile. */
export function CompactStatGrid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <div className={`grid gap-2 ${cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>{children}</div>;
}

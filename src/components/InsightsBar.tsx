import { motion } from 'framer-motion';
import { AlertTriangle, TrendingUp, TrendingDown, Sparkles, Target, Info, LucideIcon } from 'lucide-react';

export type InsightTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface Insight {
  id: string;
  tone: InsightTone;
  icon?: LucideIcon;
  title: string;
  description?: string;
}

const TONE_STYLES: Record<InsightTone, { container: string; iconWrap: string; icon: string; title: string }> = {
  success: {
    container: 'border-success/30 bg-success/5',
    iconWrap: 'bg-success/15',
    icon: 'text-success',
    title: 'text-success',
  },
  warning: {
    container: 'border-amber-300/40 bg-amber-50/60 dark:bg-amber-950/20',
    iconWrap: 'bg-amber-100 dark:bg-amber-900/30',
    icon: 'text-amber-600 dark:text-amber-400',
    title: 'text-amber-700 dark:text-amber-400',
  },
  danger: {
    container: 'border-destructive/30 bg-destructive/5',
    iconWrap: 'bg-destructive/15',
    icon: 'text-destructive',
    title: 'text-destructive',
  },
  info: {
    container: 'border-primary/30 bg-primary/5',
    iconWrap: 'bg-primary/15',
    icon: 'text-primary',
    title: 'text-primary',
  },
  neutral: {
    container: 'border-border bg-card',
    iconWrap: 'bg-muted',
    icon: 'text-muted-foreground',
    title: 'text-foreground',
  },
};

const DEFAULT_ICONS: Record<InsightTone, LucideIcon> = {
  success: TrendingUp,
  warning: AlertTriangle,
  danger: AlertTriangle,
  info: Info,
  neutral: Sparkles,
};

interface InsightsBarProps {
  insights: Insight[];
  title?: string;
  emptyHint?: string;
}

export function InsightsBar({ insights, title = 'Insights', emptyHint }: InsightsBarProps) {
  if (!insights.length) {
    if (!emptyHint) return null;
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground flex items-center gap-2">
        <Sparkles className="w-4 h-4" /> {emptyHint}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {insights.map((ins, i) => {
          const style = TONE_STYLES[ins.tone];
          const Icon = ins.icon || DEFAULT_ICONS[ins.tone];
          return (
            <motion.div
              key={ins.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`rounded-xl border ${style.container} p-3 flex items-start gap-3`}
            >
              <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${style.iconWrap}`}>
                <Icon className={`w-4 h-4 ${style.icon}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold leading-tight ${style.title}`}>{ins.title}</p>
                {ins.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{ins.description}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export { TrendingUp, TrendingDown };

import { useMemo, useState } from 'react';
import { getEntries } from '@/lib/storage';
import { FinancialEntry } from '@/types/financial';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface FinancialCalendarProps {
  schoolId: string;
  selectedMonth: string; // 'all' or 'YYYY-MM'
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function FinancialCalendar({ schoolId, selectedMonth }: FinancialCalendarProps) {
  const entries = useMemo(() => getEntries(schoolId), [schoolId]);

  const now = new Date();
  const initialMonth = selectedMonth !== 'all' ? selectedMonth : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [viewMonth, setViewMonth] = useState(initialMonth);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [year, month] = viewMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=Sun

  const dayData = useMemo(() => {
    const map: Record<string, { entradas: number; saidas: number; items: FinancialEntry[] }> = {};
    entries.forEach(e => {
      if (!e.data.startsWith(viewMonth)) return;
      if (!map[e.data]) map[e.data] = { entradas: 0, saidas: 0, items: [] };
      if (e.tipo === 'entrada') map[e.data].entradas += e.valor;
      else map[e.data].saidas += e.valor;
      map[e.data].items.push(e);
    });
    return map;
  }, [entries, viewMonth]);

  const navigate = (dir: number) => {
    let m = month + dir;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setViewMonth(`${y}-${String(m).padStart(2, '0')}`);
    setSelectedDay(null);
  };

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const selectedDayData = selectedDay ? dayData[selectedDay] : null;

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <h3 className="font-display font-semibold text-foreground">{monthNames[month - 1]} {year}</h3>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayNames.map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />;
            const dateStr = `${viewMonth}-${String(day).padStart(2, '0')}`;
            const dd = dayData[dateStr];
            const saldo = dd ? dd.entradas - dd.saidas : 0;
            const hasData = !!dd;
            const isNegative = hasData && saldo < 0;
            const isSelected = selectedDay === dateStr;

            return (
              <button
                key={day}
                onClick={() => hasData && setSelectedDay(isSelected ? null : dateStr)}
                className={`relative p-1 rounded-lg text-xs min-h-[56px] flex flex-col items-center justify-start transition-all ${
                  isSelected ? 'ring-2 ring-primary bg-primary/10' :
                  isNegative ? 'bg-destructive/10 hover:bg-destructive/20' :
                  hasData ? 'bg-primary/5 hover:bg-primary/10' :
                  'hover:bg-muted/50'
                } ${hasData ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span className={`font-medium ${isNegative ? 'text-destructive' : 'text-foreground'}`}>{day}</span>
                {hasData && (
                  <div className="mt-0.5 space-y-0.5 w-full text-center">
                    <div className="text-[9px] text-primary font-medium leading-none">+{(dd.entradas / 1000).toFixed(0)}k</div>
                    <div className="text-[9px] text-destructive font-medium leading-none">-{(dd.saidas / 1000).toFixed(0)}k</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Day detail */}
      <AnimatePresence>
        {selectedDay && selectedDayData && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card rounded-xl overflow-hidden"
          >
            <div className="px-5 py-3 flex items-center justify-between border-b border-border/50">
              <h4 className="font-display font-semibold text-sm text-foreground">
                {selectedDay.split('-').reverse().join('/')}
              </h4>
              <button onClick={() => setSelectedDay(null)} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-3 gap-3 px-5 py-3 border-b border-border/30">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Entradas</p>
                <p className="text-sm font-bold text-primary">{formatCurrency(selectedDayData.entradas)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Saídas</p>
                <p className="text-sm font-bold text-destructive">{formatCurrency(selectedDayData.saidas)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Saldo</p>
                <p className={`text-sm font-bold ${selectedDayData.entradas - selectedDayData.saidas >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {formatCurrency(selectedDayData.entradas - selectedDayData.saidas)}
                </p>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-muted/30">
                  <th className="px-4 py-1.5 text-left text-muted-foreground font-medium">Tipo</th>
                  <th className="px-4 py-1.5 text-left text-muted-foreground font-medium">Descrição</th>
                  <th className="px-4 py-1.5 text-right text-muted-foreground font-medium">Valor</th>
                </tr></thead>
                <tbody>
                  {selectedDayData.items.map(e => (
                    <tr key={e.id} className="border-t border-border/20">
                      <td className={`px-4 py-1.5 font-medium ${e.tipo === 'entrada' ? 'text-primary' : 'text-destructive'}`}>
                        {e.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </td>
                      <td className="px-4 py-1.5 text-muted-foreground truncate max-w-[180px]">{e.descricao}</td>
                      <td className={`px-4 py-1.5 text-right font-semibold ${e.tipo === 'entrada' ? 'text-primary' : 'text-destructive'}`}>
                        {formatCurrency(e.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

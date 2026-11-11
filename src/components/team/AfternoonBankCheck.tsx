import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { School } from '@/types/financial';
import {
  useManagementPortfolio, useManagementDailyStatus, useManagementBankAvailability, useManagementResponsibleDisplayNames, todaySaoPaulo,
} from '@/hooks/useManagementPortfolio';
import { defaultReportMonth } from '@/lib/reportMonth';
import { minutesSaoPaulo } from '@/lib/teamAlerts';
import { afternoonBankCheck, AFTERNOON_CHECK_MINUTES } from '@/lib/afternoonBankCheck';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Landmark } from 'lucide-react';

const ACK_KEY = 'resumo-extratos-1530';

/** Aviso diário às 15:30 para quem vê todas as carteiras. */
export function AfternoonBankCheck({ schools, onOpenSchool }: { schools: School[]; onOpenSchool: (s: School) => void }) {
  const { user, isSuperAdmin, profile } = useAuth() as any;
  const enabled = !!user?.id && (isSuperAdmin || (profile?.role === 'admin' && !!profile?.permissions?.includes('team_oversight')));
  const today = todaySaoPaulo();
  const [mins, setMins] = useState(minutesSaoPaulo());
  useEffect(() => { const i = setInterval(() => setMins(minutesSaoPaulo()), 60_000); return () => clearInterval(i); }, []);
  const active = enabled && mins >= AFTERNOON_CHECK_MINUTES;

  const { data: rows = [] } = useManagementPortfolio(defaultReportMonth(today, false), active);
  const { data: daily = [] } = useManagementDailyStatus(today, active);
  const { data: bankStart } = useManagementBankAvailability(active);
  const { data: names = [] } = useManagementResponsibleDisplayNames(active);
  const qc = useQueryClient();
  const { data: seen } = useQuery({
    queryKey: ['team_alert_acks', 'afternoon', user?.id, today], enabled: active,
    queryFn: async () => { const { data } = await (supabase as any).from('team_alert_acks').select('alert_key').eq('dia', today).eq('alert_key', ACK_KEY).maybeSingle(); return !!data; },
  });

  const people = useMemo(() => bankStart ? afternoonBankCheck({
    rows, daily, bankStart, today, names: new Map(names.map(n => [n.user_id, n.display_name])),
  }) : [], [rows, daily, bankStart, today, names]);
  const total = people.reduce((s, p) => s + p.schools.length, 0);

  const [open, setOpen] = useState(false);
  useEffect(() => { if (active && seen === false && bankStart && rows.length) setOpen(true); }, [active, seen, bankStart, rows.length]);

  if (!active) return null;
  const close = async () => {
    setOpen(false);
    if (!seen) { await (supabase as any).from('team_alert_acks').upsert({ user_id: user.id, alert_key: ACK_KEY, dia: today }); qc.invalidateQueries({ queryKey: ['team_alert_acks', 'afternoon', user?.id, today] }); }
  };
  const go = (id: string) => { const s = schools.find(x => x.id === id); if (s) { close(); onOpenSchool(s); } };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="fixed bottom-4 right-[4.5rem] z-50 h-11 rounded-full bg-card shadow-lg" aria-label="Extratos e conciliação de hoje">
        <Landmark className="mr-1.5 h-4 w-4" /> Extratos hoje
        {total > 0 && <span className="ml-1.5 rounded-full bg-destructive px-1.5 text-[11px] font-semibold leading-5 text-destructive-foreground">{total}</span>}
      </Button>
      <Dialog open={open} onOpenChange={o => !o && close()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" /> Extratos e conciliação de hoje (15:30)</DialogTitle>
            <DialogDescription>Empresas com Fluxo Bancário que ainda não receberam extrato hoje ou não tiveram nenhuma conciliação. Clique na empresa para abrir.</DialogDescription>
          </DialogHeader>
          {total === 0 ? <p className="text-sm text-muted-foreground">Todas as empresas já receberam extrato e tiveram conciliação hoje.</p> : (
            <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
              {people.map(p => (
                <section key={p.key}>
                  <p className="mb-1.5 text-sm font-semibold text-foreground">{p.label} <span className="font-normal text-muted-foreground">· {p.schools.length}</span></p>
                  <ul className="divide-y rounded-md border">
                    {p.schools.map(s => (
                      <li key={s.schoolId}>
                        <button type="button" onClick={() => go(s.schoolId)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60">
                          <span className="truncate">{s.schoolName}</span>
                          <span className="flex shrink-0 gap-1">
                            {s.noStatement && <Badge variant="destructive">Sem extrato</Badge>}
                            {s.noRecon && <Badge variant="outline" className="border-warning text-warning">Sem conciliação</Badge>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          <DialogFooter><Button onClick={close}>Entendi</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

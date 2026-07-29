import { useMemo, useState } from 'react';
import { Download, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSchool } from '@/hooks/useFinancialData';
import { usePeriodMovementCtx } from '@/hooks/usePeriodMovementCtx';
import { useSchoolModel } from '@/hooks/useSchoolModel';
import { buildMonthMovement, computeSaldoInicial, computeSaldoFinal } from '@/lib/periodMovement';
import { toast } from '@/hooks/use-toast';

interface Props {
  schoolId: string;
  /** 'all' ou 'YYYY-MM,...' — usado apenas como sugestão inicial de mês. */
  selectedMonth: string;
}

const MES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function monthLabel(m: string) {
  const [y, mm] = m.split('-');
  return `${MES_NOMES[parseInt(mm, 10) - 1]} de ${y}`;
}

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const SOURCE_LABEL: Record<string, string> = {
  snapshot: 'Mês fechado',
  fluxo: 'Realizado',
  historico: 'Histórico',
  projecao: 'Projeção',
  vazio: 'Sem dados',
};

/**
 * Botão "Baixar imagem" — gera um PNG do resumo mensal desenhado em canvas
 * (não é print de tela), em alta resolução, pronto para compartilhamento.
 */
export function ResumoMensalImagem({ schoolId, selectedMonth }: Props) {
  const { data: school } = useSchool(schoolId);
  const { ctx } = usePeriodMovementCtx(schoolId);
  const { isInModel } = useSchoolModel(schoolId);
  const [open, setOpen] = useState(false);
  const [gerando, setGerando] = useState(false);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    ctx.entries.forEach(e => set.add((e.dataProjetada || '').slice(0, 7)));
    ctx.historicalRows.forEach(r => set.add(r.month));
    ctx.snapshotMap.forEach((_v, k) => set.add(k));
    return Array.from(set).filter(m => /^\d{4}-\d{2}$/.test(m)).sort();
  }, [ctx]);

  const initialMonth = useMemo(() => {
    const list = selectedMonth && selectedMonth !== 'all'
      ? selectedMonth.split(',').map(s => s.trim()).filter(Boolean).sort()
      : [];
    const candidate = list[list.length - 1];
    if (candidate && availableMonths.includes(candidate)) return candidate;
    return availableMonths[availableMonths.length - 1] ?? '';
  }, [selectedMonth, availableMonths]);

  const [month, setMonth] = useState<string>('');
  const activeMonth = month || initialMonth;

  const resumo = useMemo(() => {
    if (!activeMonth) return null;
    const mv = buildMonthMovement(activeMonth, ctx, { isInModel });
    const saldoInicial = computeSaldoInicial(activeMonth, ctx, { isInModel });
    const saldoFinal = computeSaldoFinal(activeMonth, ctx, { isInModel });
    const tipos = mv.porTipo
      .filter(t => t.valor > 0 && t.classificacao !== 'ignorar')
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
    return {
      mv,
      saldoInicial,
      saldoFinal,
      tipos,
      resultado: mv.receitas - mv.despesas,
    };
  }, [activeMonth, ctx, isInModel]);

  async function gerarPng() {
    if (!resumo || !activeMonth) return;
    setGerando(true);
    try {
      const S = 2; // fator de alta resolução
      const W = 1080, H = 1350;
      const canvas = document.createElement('canvas');
      canvas.width = W * S;
      canvas.height = H * S;
      const c = canvas.getContext('2d');
      if (!c) throw new Error('Canvas indisponível');
      c.scale(S, S);

      const COLORS = {
        bg: '#0f1720',
        card: '#16212c',
        line: '#25333f',
        text: '#f4f7f9',
        muted: '#8fa3b0',
        green: '#22c55e',
        red: '#ef4444',
        teal: '#14b8a6',
        orange: '#f97316',
      };

      const font = (size: number, weight = '400') => `${weight} ${size}px "Inter", "Helvetica Neue", Arial, sans-serif`;

      // Fundo
      c.fillStyle = COLORS.bg;
      c.fillRect(0, 0, W, H);
      const grad = c.createLinearGradient(0, 0, W, 320);
      grad.addColorStop(0, 'rgba(20,184,166,0.28)');
      grad.addColorStop(1, 'rgba(249,115,22,0.18)');
      c.fillStyle = grad;
      c.fillRect(0, 0, W, 320);

      const M = 72;

      // Cabeçalho
      c.fillStyle = COLORS.text;
      c.font = font(46, '700');
      c.fillText(school?.nome ?? 'Resumo Financeiro', M, 132);
      c.fillStyle = COLORS.muted;
      c.font = font(26, '500');
      c.fillText(monthLabel(activeMonth).toUpperCase(), M, 176);

      // Badge da fonte
      const badge = SOURCE_LABEL[resumo.mv.source] ?? resumo.mv.source;
      c.font = font(20, '600');
      const bw = c.measureText(badge).width + 36;
      c.fillStyle = 'rgba(20,184,166,0.22)';
      c.beginPath();
      c.roundRect(M, 198, bw, 40, 20);
      c.fill();
      c.fillStyle = COLORS.teal;
      c.fillText(badge, M + 18, 225);

      // Cards principais
      const cardW = (W - M * 2 - 24) / 2;
      const drawCard = (x: number, y: number, w: number, h: number) => {
        c.fillStyle = COLORS.card;
        c.beginPath();
        c.roundRect(x, y, w, h, 22);
        c.fill();
        c.strokeStyle = COLORS.line;
        c.lineWidth = 1.5;
        c.stroke();
      };
      const drawKpi = (x: number, y: number, w: number, label: string, value: number, color: string) => {
        const h = 138;
        drawCard(x, y, w, h);
        c.fillStyle = COLORS.muted;
        c.font = font(20, '600');
        c.fillText(label.toUpperCase(), x + 28, y + 48);
        c.fillStyle = color;
        c.font = font(38, '700');
        c.fillText(brl(value), x + 28, y + 100);
      };

      let y = 288;
      drawKpi(M, y, cardW, 'Saldo inicial', resumo.saldoInicial, COLORS.text);
      drawKpi(M + cardW + 24, y, cardW, 'Saldo final', resumo.saldoFinal, resumo.saldoFinal >= 0 ? COLORS.green : COLORS.red);
      y += 162;
      drawKpi(M, y, cardW, 'Receitas', resumo.mv.receitas, COLORS.green);
      drawKpi(M + cardW + 24, y, cardW, 'Despesas', resumo.mv.despesas, COLORS.red);
      y += 162;

      // Resultado (destaque)
      drawCard(M, y, W - M * 2, 150);
      c.fillStyle = COLORS.muted;
      c.font = font(22, '600');
      c.fillText('RESULTADO DO MÊS', M + 32, y + 52);
      c.fillStyle = resumo.resultado >= 0 ? COLORS.green : COLORS.red;
      c.font = font(54, '700');
      c.fillText(brl(resumo.resultado), M + 32, y + 116);
      // Operações à direita
      c.textAlign = 'right';
      c.fillStyle = COLORS.muted;
      c.font = font(18, '500');
      c.fillText(`Operações (entrada): ${brl(resumo.mv.operacoesIn)}`, W - M - 32, y + 70);
      c.fillText(`Operações (saída): ${brl(resumo.mv.operacoesOut)}`, W - M - 32, y + 104);
      c.textAlign = 'left';
      y += 186;

      // Detalhamento por tipo
      if (resumo.tipos.length > 0) {
        const rows = resumo.tipos;
        const h = 74 + rows.length * 52;
        drawCard(M, y, W - M * 2, h);
        c.fillStyle = COLORS.muted;
        c.font = font(20, '700');
        c.fillText('DETALHAMENTO POR TIPO', M + 32, y + 48);
        let ry = y + 92;
        rows.forEach(t => {
          const color = t.classificacao === 'receita' ? COLORS.green
            : t.classificacao === 'despesa' ? COLORS.red
            : COLORS.muted;
          c.fillStyle = COLORS.text;
          c.font = font(24, '500');
          let label = t.label;
          while (c.measureText(label).width > W - M * 2 - 400 && label.length > 4) {
            label = label.slice(0, -2);
          }
          if (label !== t.label) label += '…';
          c.fillText(label, M + 32, ry);
          c.textAlign = 'right';
          c.fillStyle = color;
          c.font = font(24, '700');
          c.fillText(brl(t.valor), W - M - 32, ry);
          c.textAlign = 'left';
          c.strokeStyle = COLORS.line;
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(M + 32, ry + 18);
          c.lineTo(W - M - 32, ry + 18);
          c.stroke();
          ry += 52;
        });
        y += h + 24;
      }

      // Rodapé
      c.fillStyle = COLORS.muted;
      c.font = font(18, '500');
      const gerado = new Date().toLocaleDateString('pt-BR');
      c.fillText(`Gerado em ${gerado}`, M, H - 56);
      c.textAlign = 'right';
      c.fillStyle = COLORS.orange;
      c.font = font(18, '700');
      c.fillText('Resumo Mensal', W - M, H - 56);
      c.textAlign = 'left';

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `resumo-${(school?.nome ?? 'empresa').toLowerCase().replace(/\s+/g, '-')}-${activeMonth}.png`;
      a.click();
      toast({ title: 'Imagem gerada', description: `Resumo de ${monthLabel(activeMonth)} baixado.` });
      setOpen(false);
    } catch (err: any) {
      toast({ title: 'Erro ao gerar imagem', description: err?.message ?? 'Tente novamente.', variant: 'destructive' });
    } finally {
      setGerando(false);
    }
  }

  if (availableMonths.length === 0) return null;

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <ImageIcon className="w-4 h-4" />
        <span className="hidden xs:inline sm:inline">Baixar imagem</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Baixar resumo em imagem</DialogTitle>
            <DialogDescription>
              Escolha o mês. Funciona para meses fechados e para o próximo mês, quando houver projeção.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Select value={activeMonth} onValueChange={setMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {availableMonths.map(m => (
                  <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {resumo && (
              <div className="rounded-lg border border-border/50 p-3 text-xs space-y-1.5 bg-muted/20">
                <div className="flex justify-between"><span className="text-muted-foreground">Fonte</span><span className="font-medium">{SOURCE_LABEL[resumo.mv.source]}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Saldo inicial</span><span className="font-medium">{brl(resumo.saldoInicial)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Receitas</span><span className="font-medium text-success">{brl(resumo.mv.receitas)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Despesas</span><span className="font-medium text-destructive">{brl(resumo.mv.despesas)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Resultado</span><span className="font-medium">{brl(resumo.resultado)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Saldo final</span><span className="font-medium">{brl(resumo.saldoFinal)}</span></div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={gerarPng} disabled={!resumo || gerando} className="gap-1.5 w-full sm:w-auto">
              <Download className="w-4 h-4" />
              {gerando ? 'Gerando…' : 'Baixar PNG'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

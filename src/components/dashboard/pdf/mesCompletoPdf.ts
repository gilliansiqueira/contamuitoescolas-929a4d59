import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import contaMuitoLogo from '@/assets/logo-conta-muito.png';

type RGB = [number, number, number];
const GRAPHITE: RGB = [39, 55, 62];
const GRAPHITE_2: RGB = [48, 67, 75];
const ORANGE: RGB = [245, 125, 32];
const TEAL: RGB = [105, 193, 179];
const GREEN: RGB = [45, 183, 115];
const PINK: RGB = [244, 101, 130];
const WHITE: RGB = [250, 251, 251];
const MUTED: RGB = [183, 197, 202];
const GRID: RGB = [77, 96, 104];
const PAGE_W = 338.667;
const PAGE_H = 190.5;
const MX = 18;
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const fmtBRL = (value: number) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNumber = (value: number, decimals = 0) => Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const compactMoney = (value: number) => Math.abs(value) >= 1_000_000
  ? `R$ ${fmtNumber(value / 1_000_000, 1)} mi`
  : Math.abs(value) >= 1_000 ? `R$ ${fmtNumber(value / 1_000, 0)} mil` : fmtBRL(value);
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export interface MesCompletoRow { label: string; valor: number; sub?: string }
export interface MonthlyReportRow {
  month: string; label: string; source: string; saldoInicial: number; receitas: number; despesas: number;
  receitasRealizadas: number; despesasRealizadas: number; receitasPrevistas: number; despesasPrevistas: number;
  resultado: number; operacoesIn: number; operacoesOut: number; saldoFinal: number;
}
export interface ExpenseReportRow { mae: string; filha: string; valor: number }
export interface ExpenseExcludedRow { date: string; description: string; account: string; value: number; reason: string }
export interface ExpenseHistoryRow { category: string; year: string; months: (number | null)[] }
export interface AnnualFinancialRow { year: string; months: (number | null)[] }
export interface SalesReportRow { month: string; method: string; brand?: string; value: number }
export interface LegacyKpiReportRow { month: string; lucratividade: number | null; inadimplencia: number | null; mediaAlunosTurma: number | null; alunosModalidade: number | null; evasao: number | null }
export interface ExpenseCeilingReportRow { category: string; ceiling: number; scope: string; parentGroup?: string | null; semester: string }
export interface ConversionThresholdReportRow { tipo: string; min: number | null; max: number | null; label: string }
export interface KpiReportRow {
  id: string; name: string; value: number | null; valueType: string; direction: 'higher_is_better' | 'lower_is_better'; decimals: number;
  status?: string; statusColor?: string; previousValue?: number | null; previousMonth?: string; variation?: number | null; history: { label: string; value: number }[];
  yoy?: { avgCurrent: number; avgPrevious: number; delta: number; relPct: number | null; improvement: boolean; previousYear: string; monthLabel: string } | null;
  thresholds: { min: number | null; max: number | null; label: string }[];
}

export interface ConversionReportRow { month: string; label: string; tipo: string; contatos: number; matriculas: number; taxa: number }
export interface OperationReportRow { label: string; valor: number; isEntrada: boolean }
export interface MesCompletoData {
  schoolName: string; periodoLabel: string; saldoInicial: number; saldoFinal: number; receitas: number; despesas: number; resultado: number;
  operacoesIn: number; operacoesOut: number;
  operations: OperationReportRow[];
  porTipo: { label: string; valor: number; classificacao: string }[]; recebiveis: MesCompletoRow[]; contasPagar: MesCompletoRow[];
  anterior?: { label: string; receitas: number; despesas: number; resultado: number; saldoFinal: number };
  monthly: MonthlyReportRow[]; annualRevenue: AnnualFinancialRow[]; annualExpenses: AnnualFinancialRow[]; annualResult?: AnnualFinancialRow[];
  expenses: ExpenseReportRow[]; expenseDetailTotal: number; analysisExpenses: ExpenseReportRow[]; analysisExpenseTotal: number;
  rawExpenseTotal: number; excludedExpenseRows: ExpenseExcludedRow[];
  expenseHistory: ExpenseHistoryRow[];
  monthlyRevenue: { month: string; value: number }[]; expenseCeilings: ExpenseCeilingReportRow[]; sales: SalesReportRow[];
  legacyKpis: LegacyKpiReportRow[]; kpis: KpiReportRow[]; conversion: ConversionReportRow[];
  conversionThresholds: ConversionThresholdReportRow[]; enrollmentsYoY: { label: string; current: number; previous: number }[];
  annualEnrollments: AnnualFinancialRow[]; annualContacts: AnnualFinancialRow[]; currentYear: string; previousYear: string; referenceMonth: string;
  sources: string[]; fileName?: string;
}

export function sumAnnualThroughReference(row: AnnualFinancialRow, referenceMonth: string): number {
  const cutoff = Math.max(0, Math.min(11, Number(referenceMonth.slice(5, 7)) - 1));
  return row.months.slice(0, cutoff + 1).reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

export function aggregateExpensesByMother(rows: ExpenseReportRow[]): { mae: string; valor: number }[] {
  const totals = new Map<string, number>();
  rows.forEach(row => totals.set(row.mae, (totals.get(row.mae) ?? 0) + row.valor));
  return [...totals.entries()].map(([mae, valor]) => ({ mae, valor })).sort((a, b) => b.valor - a.valor);
}

export function summarizeOperations(rows: OperationReportRow[]) {
  const entradas = rows.filter(row => row.isEntrada).reduce((sum, row) => sum + row.valor, 0);
  const saidas = rows.filter(row => !row.isEntrada).reduce((sum, row) => sum + row.valor, 0);
  return { entradas, saidas, liquido: entradas - saidas };
}

async function loadLogo(): Promise<string | null> {
  try {
    const blob = await fetch(contaMuitoLogo).then(response => response.blob());
    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

/** Converte a cor da faixa configurada (hex) para RGB do jsPDF. */
function hexToRgb(hex?: string): RGB | null {
  if (!hex) return null;
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}


function formatKpi(value: number | null, type: string, decimals: number) {
  if (value === null) return '—';
  if (type === 'currency') return fmtBRL(value);
  if (type === 'percent') return `${fmtNumber(value, decimals)}%`;
  return fmtNumber(value, decimals);
}

export async function generateMesCompletoPdf(data: MesCompletoData) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [PAGE_H, PAGE_W] });
  const logo = await loadLogo();
  const generatedAt = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  let pageCount = 0;

  const background = () => {
    pdf.setFillColor(...GRAPHITE); pdf.rect(0, 0, PAGE_W, PAGE_H, 'F');
  };
  const addPage = (title?: string, subtitle?: string) => {
    if (pageCount > 0) pdf.addPage([PAGE_H, PAGE_W], 'landscape');
    pageCount += 1; background();
    if (!title) return;
    pdf.setTextColor(...WHITE); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(22); pdf.text(title.toUpperCase(), MX, 22);
    pdf.setFillColor(...ORANGE); pdf.rect(MX, 28, PAGE_W - MX * 2, 1.5, 'F');
    if (subtitle) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...MUTED); pdf.text(subtitle, MX, 35); }
    pdf.setTextColor(...WHITE); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.text(data.schoolName, PAGE_W - MX - 14, 17, { align: 'right' });
    pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...MUTED); pdf.text(data.periodoLabel, PAGE_W - MX - 14, 22, { align: 'right' });
    if (logo) { try { pdf.addImage(logo, 'PNG', PAGE_W - MX - 10, 9, 10, 10); } catch { /* logo opcional */ } }
  };
  const text = (value: string, x: number, y: number, size = 9, color: RGB = WHITE, style: 'normal' | 'bold' = 'normal', options?: { align?: 'left' | 'center' | 'right'; maxWidth?: number }) => {
    pdf.setTextColor(...color); pdf.setFont('helvetica', style); pdf.setFontSize(size); pdf.text(value, x, y, options);
  };
  const metric = (x: number, y: number, width: number, label: string, value: string, color: RGB, note?: string) => {
    pdf.setFillColor(...GRAPHITE_2); pdf.roundedRect(x, y, width, 28, 2, 2, 'F');
    pdf.setFillColor(...color); pdf.rect(x, y, 2, 28, 'F');
    text(label.toUpperCase(), x + 6, y + 8, 7, MUTED, 'bold');
    let fontSize = 14; pdf.setFont('helvetica', 'bold'); pdf.setFontSize(fontSize);
    while (pdf.getTextWidth(value) > width - 12 && fontSize > 9) { fontSize -= .5; pdf.setFontSize(fontSize); }
    text(value, x + 6, y + 18, fontSize, color, 'bold');
    if (note) text(note, x + 6, y + 24, 6.2, MUTED);
  };
  const bars = (items: { label: string; value: number; color?: RGB }[], x: number, y: number, width: number, maxRows = 8) => {
    const rows = items.slice(0, maxRows); const max = Math.max(...rows.map(row => row.value), 1);
    rows.forEach((row, index) => {
      const yy = y + index * 14;
      text(row.label.slice(0, 40), x, yy, 8, WHITE);
      text(fmtBRL(row.value), x + width, yy, 8, WHITE, 'bold', { align: 'right' });
      pdf.setFillColor(...GRID); pdf.roundedRect(x, yy + 3, width, 3.5, 1.5, 1.5, 'F');
      pdf.setFillColor(...(row.color ?? TEAL)); pdf.roundedRect(x, yy + 3, Math.max(1, width * row.value / max), 3.5, 1.5, 1.5, 'F');
    });
  };
  const horizontalBars = (
    items: { label: string; value: number; detail?: string; color?: RGB }[],
    x: number, y: number, width: number, height: number,
  ) => {
    const rows = items.filter(item => item.value > 0);
    if (!rows.length) return;
    const max = Math.max(...rows.map(row => row.value), 1);
    const labelWidth = Math.min(70, width * .27);
    const valueWidth = 43;
    const barWidth = width - labelWidth - valueWidth;
    const rowHeight = Math.min(13, height / rows.length);
    rows.forEach((row, index) => {
      const yy = y + index * rowHeight + rowHeight * .5;
      const fontSize = rows.length > 10 ? 6.2 : 7.2;
      text(row.label.slice(0, 38), x + labelWidth - 3, yy + 1.5, fontSize, WHITE, 'bold', { align: 'right', maxWidth: labelWidth - 4 });
      pdf.setFillColor(...GRID); pdf.roundedRect(x + labelWidth, yy - 2.3, barWidth, 4.6, 1.7, 1.7, 'F');
      pdf.setFillColor(...(row.color ?? ORANGE));
      pdf.roundedRect(x + labelWidth, yy - 2.3, Math.max(1.2, barWidth * row.value / max), 4.6, 1.7, 1.7, 'F');
      text(row.detail ?? fmtBRL(row.value), x + labelWidth + barWidth + 4, yy + 1.5, fontSize, MUTED, 'bold', { maxWidth: valueWidth - 4 });
    });
  };
  const lineChart = (series: { values: (number | null)[]; color: RGB }[], labels: string[], x: number, y: number, width: number, height: number, zeroBase = false) => {
    const points = series.flatMap(item => item.values).filter((value): value is number => value !== null);
    if (!series.some(item => item.values.filter(value => value !== null).length >= 2) || points.length < 2 || labels.length < 2) return false;
    const min = zeroBase ? Math.min(0, ...points) : Math.min(...points);
    const max = Math.max(...points); const pad = Math.max((max - min) * .12, 1); const low = zeroBase ? min : min - pad; const high = max + pad; const span = high - low || 1;
    pdf.setDrawColor(...GRID); pdf.setLineWidth(.25);
    for (let i = 0; i <= 4; i += 1) pdf.line(x, y + height * i / 4, x + width, y + height * i / 4);
    labels.forEach((label, index) => text(label, x + index * width / (labels.length - 1), y + height + 6, 6.5, MUTED, 'normal', { align: 'center' }));
    series.forEach(item => {
      pdf.setDrawColor(...item.color); pdf.setFillColor(...item.color); pdf.setLineWidth(1);
      let previous: { x: number; y: number } | null = null;
      item.values.forEach((value, index) => {
        if (value === null) { previous = null; return; }
        const px = x + index * width / (labels.length - 1); const py = y + height - (value - low) / span * height;
        if (previous) pdf.line(previous.x, previous.y, px, py);
        pdf.circle(px, py, 1.2, 'F'); previous = { x: px, y: py };
      });
    });
    return true;
  };
  const legend = (items: { label: string; color: RGB }[], x: number, y: number) => {
    items.forEach((item, index) => {
      const xx = x + index * 34;
      pdf.setDrawColor(...item.color); pdf.setLineWidth(1.2); pdf.line(xx, y, xx + 8, y);
      text(item.label, xx + 11, y + 1.5, 7, MUTED);
    });
  };
  const annualComparisonPage = (title: string, rows: AnnualFinancialRow[], valueKind: 'money' | 'count' = 'money') => {
    // Compara sempre o ano do período selecionado com o ano anterior — nunca anos futuros.
    const pick = (year: string) => rows.find(row => row.year === year && row.months.some(value => value !== null));
    const previous = pick(data.previousYear);
    const current = pick(data.currentYear);
    const validRows = [previous, current].filter((row): row is AnnualFinancialRow => !!row);
    if (!validRows.length) return;
    const subtitle = previous
      ? `${data.previousYear} x ${data.currentYear} · meses sem informação permanecem vazios`
      : `${data.currentYear} · sem histórico de ${data.previousYear} para comparação`;
    addPage(title, subtitle);
    const colorOf = (row: AnnualFinancialRow) => (row.year === data.currentYear ? ORANGE : TEAL);
    const cutoff = Math.max(0, Math.min(11, Number(data.referenceMonth.slice(5, 7)) - 1));
    validRows.forEach((row, index) => {
      // Os gráficos mantêm o ano completo; os cartões comparam sempre Jan→mês de referência.
      const values = row.months.slice(0, cutoff + 1).filter((value): value is number => value !== null);
      const total = sumAnnualThroughReference(row, data.referenceMonth);
      const value = valueKind === 'money' ? compactMoney(total) : fmtNumber(total);
      const averageValue = values.length ? total / values.length : 0;
      const average = valueKind === 'money' ? compactMoney(averageValue) : fmtNumber(averageValue, 1);
      metric(MX + index * 105, 43, 94, row.year, value, colorOf(row), `Média mensal ${average}`);
    });
    if (previous && current) {
      // Comparação justa: acumulado de janeiro até o mês de referência nos dois anos.
      const base = sumAnnualThroughReference(previous, data.referenceMonth);
      const delta = base ? (sumAnnualThroughReference(current, data.referenceMonth) - base) / Math.abs(base) * 100 : null;
      metric(MX + 210, 43, 94, `${data.currentYear} vs ${data.previousYear}`,
        delta === null ? '—' : `${delta > 0 ? '+' : ''}${fmtNumber(delta, 1)}%`,
        delta === null ? MUTED : delta >= 0 ? GREEN : PINK, `Acumulado Jan–${MONTHS[cutoff]} nos dois anos`);

    }
    legend(validRows.map(row => ({ label: row.year, color: colorOf(row) })), PAGE_W - 95, 80);
    lineChart(validRows.map(row => ({ values: row.months, color: colorOf(row) })), MONTHS, MX + 8, 90, PAGE_W - MX * 2 - 16, 62, true);
  };


  // Capa e conciliação principal
  addPage();
  if (logo) { try { pdf.addImage(logo, 'PNG', MX, 14, 38, 20); } catch { /* logo opcional */ } }
  text(data.schoolName.toUpperCase(), PAGE_W / 2, 23, 25, WHITE, 'bold', { align: 'center' });
  text(`RELATÓRIO · ${data.periodoLabel.toUpperCase()}`, PAGE_W / 2, 34, 15, WHITE, 'bold', { align: 'center' });
  pdf.setFillColor(...ORANGE); pdf.rect(90, 42, PAGE_W - 180, 1.5, 'F');
  text(`SALDO INICIAL: ${fmtBRL(data.saldoInicial)}`, PAGE_W / 2, 58, 17, WHITE, 'bold', { align: 'center' });
  // O detalhamento já vem do mesmo `tipoAggregations` exibido no Dashboard.
  // Os totais continuam explícitos para preservar exatamente os cartões da tela.
  const operationsIn = data.operacoesIn;
  const operationsOut = data.operacoesOut;
  const coverItems = [
    ['Receitas', data.receitas, GREEN], ['Despesas', data.despesas, PINK],
    ['Resultado', data.resultado, data.resultado >= 0 ? TEAL : PINK], ['Operações de caixa', operationsIn - operationsOut, ORANGE],
  ] as const;
  coverItems.forEach((item, index) => metric(22 + index * 78, 76, 68, item[0], fmtBRL(item[1]), item[2]));
  text(`Entradas ${fmtBRL(operationsIn)} · Saídas ${fmtBRL(operationsOut)}`, 22 + 3 * 78 + 34, 108, 6.5, MUTED, 'normal', { align: 'center', maxWidth: 64 });
  pdf.setDrawColor(...ORANGE); pdf.setLineWidth(1.2); pdf.roundedRect(113, 125, 113, 28, 1, 1, 'S');
  text(`SALDO FINAL: ${fmtBRL(data.saldoFinal)}`, PAGE_W / 2, 143, 16, WHITE, 'bold', { align: 'center' });
  text(`Resultado ${fmtBRL(data.resultado)} · impacto líquido das operações ${fmtBRL(operationsIn - operationsOut)}`, PAGE_W / 2, 164, 8, MUTED, 'normal', { align: 'center' });

  if (data.operations.length) {
    addPage('Operações financeiras', 'Mesmos itens e valores exibidos na aba Projeção/Dashboard · não entram no resultado');
    metric(MX, 41, 88, 'Entradas', fmtBRL(operationsIn), GREEN);
    metric(MX + 99, 41, 88, 'Saídas', fmtBRL(operationsOut), PINK);
    metric(MX + 198, 41, 88, 'Impacto líquido', fmtBRL(operationsIn - operationsOut), operationsIn - operationsOut >= 0 ? TEAL : PINK);
    horizontalBars(
      [...data.operations]
        .sort((a, b) => a.valor - b.valor)
        .map(row => ({
          label: row.label,
          value: row.valor,
          detail: `${row.isEntrada ? 'Entrada' : 'Saída'} · ${fmtBRL(row.valor)}`,
          color: row.isEntrada ? GREEN : PINK,
        })),
      MX, 84, PAGE_W - MX * 2, 72,
    );
  }

  addPage('Leitura gerencial', 'Resumo objetivo para decisão');
  const margin = data.receitas ? data.resultado / data.receitas * 100 : 0;
  const expenseWeight = data.receitas ? data.despesas / data.receitas * 100 : 0;
  const cashVariation = data.saldoFinal - data.saldoInicial;
  metric(MX, 47, 92, 'Margem do resultado', `${fmtNumber(margin, 1)}%`, margin >= 0 ? GREEN : PINK, margin >= 0 ? 'O período encerrou com resultado positivo' : 'As despesas superaram as receitas');
  metric(MX + 105, 47, 92, 'Peso das despesas', `${fmtNumber(expenseWeight, 1)}%`, expenseWeight <= 100 ? TEAL : PINK, 'Participação das despesas nas receitas');
  metric(MX + 210, 47, 92, 'Variação do caixa', fmtBRL(cashVariation), cashVariation >= 0 ? GREEN : PINK, 'Saldo final menos saldo inicial');
  if (data.anterior) {
    const delta = data.resultado - data.anterior.resultado;
    text('COMPARAÇÃO COM O PERÍODO ANTERIOR', MX, 98, 10, ORANGE, 'bold');
    text(`${data.anterior.label}: resultado ${fmtBRL(data.anterior.resultado)}. Variação atual: ${delta >= 0 ? '+' : ''}${fmtBRL(delta)}.`, MX, 111, 13, WHITE, 'bold');
  }
  const attentionExpenses = data.analysisExpenses.length ? data.analysisExpenses : data.expenses;
  const topExpense = aggregateExpensesByMother(attentionExpenses)[0];
  text('PRINCIPAL PONTO DE ATENÇÃO', MX, 137, 10, ORANGE, 'bold');
  text(topExpense ? `${topExpense.mae} concentra ${fmtBRL(topExpense.valor)} no período.` : 'Não há despesas detalhadas conciliadas para o período.', MX, 150, 13, WHITE, 'bold');

  annualComparisonPage('Evolução de receitas', data.annualRevenue);
  annualComparisonPage('Evolução de despesas', data.annualExpenses);
  if (data.annualResult?.length) annualComparisonPage('Evolução do resultado', data.annualResult);


  const analysisExpenses = data.analysisExpenses.length ? data.analysisExpenses : data.expenses;
  const analysisTotal = data.analysisExpenseTotal || data.expenseDetailTotal;
  const mothers = aggregateExpensesByMother(analysisExpenses).map(row => ({ label: row.mae, value: row.valor }));
  const revenueTotal = data.monthlyRevenue.filter(row => data.monthly.some(month => month.month === row.month)).reduce((sum, row) => sum + row.value, 0);
  if (mothers.length) {
    addPage('Despesas por categoria', `Análise das despesas realizadas · faturamento ${fmtBRL(revenueTotal)}`);
    metric(MX, 41, 88, 'Despesas analisadas', fmtBRL(analysisTotal), PINK);
    metric(MX + 99, 41, 88, 'Faturamento', revenueTotal ? fmtBRL(revenueTotal) : '—', TEAL);
    metric(MX + 198, 41, 88, 'Margem consumida', revenueTotal ? `${fmtNumber(analysisTotal / revenueTotal * 100, 1)}%` : '—', ORANGE);
    horizontalBars(
      [...mothers].sort((a, b) => a.value - b.value).map(row => {
        const pct = revenueTotal ? row.value / revenueTotal * 100 : 0;
        return { ...row, detail: revenueTotal ? `${fmtBRL(row.value)}  (${fmtNumber(pct, 1)}%)` : fmtBRL(row.value), color: pct > 30 ? PINK : ORANGE };
      }),
      MX, 78, PAGE_W - MX * 2, 82,
    );

    mothers.forEach(mother => {
      const rows = analysisExpenses.filter(row => row.mae === mother.label).sort((a, b) => a.valor - b.valor);
      const history = data.expenseHistory.filter(row => row.category === mother.label && row.months.some(value => value !== null)).sort((a, b) => a.year.localeCompare(b.year)).slice(-2);
      const current = history.find(row => row.year === data.currentYear);
      const previous = history.find(row => row.year === data.previousYear);
      const cutoff = Math.max(0, Math.min(11, Number(data.referenceMonth.slice(5, 7)) - 1));
      const accumulated = (row?: ExpenseHistoryRow) => row?.months.slice(0, cutoff + 1).reduce<number>((sum, value) => sum + (value ?? 0), 0) ?? 0;
      const currentAccumulated = accumulated(current);
      const previousAccumulated = accumulated(previous);
      const delta = previousAccumulated ? (currentAccumulated - previousAccumulated) / previousAccumulated * 100 : null;
      const largest = [...rows].sort((a, b) => b.valor - a.valor)[0];
      addPage(mother.label, largest ? `Maior gasto: ${largest.filha} (${fmtBRL(largest.valor)})` : 'Análise da categoria');
      metric(MX, 40, 69, 'Total da categoria', fmtBRL(mother.value), PINK);
      metric(MX + 77, 40, 69, 'Participação', analysisTotal ? `${fmtNumber(mother.value / analysisTotal * 100, 1)}%` : '—', ORANGE);
      metric(MX + 154, 40, 69, 'Do faturamento', revenueTotal ? `${fmtNumber(mother.value / revenueTotal * 100, 1)}%` : '—', TEAL);
      metric(MX + 231, 40, 70, `Acumulado ${data.currentYear}`, fmtBRL(currentAccumulated), delta === null || delta <= 0 ? GREEN : PINK, delta === null ? `Sem histórico de ${data.previousYear}` : `vs ${data.previousYear}: ${delta > 0 ? '+' : ''}${fmtNumber(delta, 1)}%`);
      text('CATEGORIAS FILHAS', MX, 76, 8.5, MUTED, 'bold');
      horizontalBars(rows.map(row => ({ label: row.filha, value: row.valor, color: ORANGE })), MX, 82, PAGE_W - MX * 2, 48);
      text('EVOLUÇÃO MENSAL · COMPARATIVO ANUAL', MX, 138, 8.5, WHITE, 'bold');
      if (history.length && lineChart(history.map(row => ({ values: row.months, color: row.year === data.currentYear ? ORANGE : MUTED })), MONTHS, MX + 20, 144, PAGE_W - MX * 2 - 32, 24, true)) {
        legend(history.map(row => ({ label: row.year, color: row.year === data.currentYear ? ORANGE : MUTED })), PAGE_W - 92, 137);
      } else {
        text('Histórico anual insuficiente para comparação.', MX, 153, 9, MUTED);
      }
    });
  }

  if (data.kpis.some(item => item.value !== null)) {
    const activeKpis = data.kpis.filter(item => item.value !== null);
    for (let offset = 0; offset < activeKpis.length; offset += 3) {
      addPage('Indicadores de gestão', 'Valor atual, comparação com o mês anterior e com o ano passado · mesmo padrão do relatório online');
      activeKpis.slice(offset, offset + 3).forEach((item, index) => {
        const x = MX + index * 101; const y = 41; const width = 92;
        const delta = item.value !== null && item.previousValue != null ? item.value - item.previousValue : null;
        const improved = delta === null ? null : item.direction === 'higher_is_better' ? delta > 0 : delta < 0;
        // Cor do valor e do selo segue a faixa configurada (igual à plataforma), não a variação.
        const statusColor: RGB = hexToRgb(item.statusColor) ?? TEAL;
        const deltaColor = improved === false ? PINK : improved === true ? GREEN : MUTED;
        pdf.setFillColor(...GRAPHITE_2); pdf.roundedRect(x, y, width, 124, 2, 2, 'F');
        text(item.name.toUpperCase(), x + width / 2, y + 11, 8.5, MUTED, 'bold', { align: 'center', maxWidth: width - 10 });
        text(formatKpi(item.value, item.valueType, item.decimals), x + width / 2, y + 26, 19, statusColor, 'bold', { align: 'center' });
        if (item.status) {
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6);
          const badgeWidth = pdf.getTextWidth(item.status) + 8;
          pdf.setFillColor(...statusColor); pdf.roundedRect(x + width / 2 - badgeWidth / 2, y + 30, badgeWidth, 7, 3.5, 3.5, 'F');
          text(item.status, x + width / 2, y + 34.6, 6, GRAPHITE, 'bold', { align: 'center' });
        }
        if (delta !== null) {
          text(`${delta > 0 ? '+' : ''}${formatKpi(delta, item.valueType, item.decimals)} vs mês anterior · ${improved ? 'melhora' : delta === 0 ? 'estável' : 'atenção'}`, x + width / 2, y + 45, 6.8, deltaColor, 'bold', { align: 'center', maxWidth: width - 8 });
        }
        if (item.yoy) {
          const yoyColor = item.yoy.improvement ? GREEN : PINK;
          const relative = item.yoy.relPct === null ? '' : ` (${item.yoy.relPct > 0 ? '+' : ''}${fmtNumber(item.yoy.relPct, 1)}%)`;
          text(`${item.yoy.delta > 0 ? '+' : ''}${formatKpi(item.yoy.delta, item.valueType, item.decimals)}${relative} vs ${item.yoy.previousYear}`, x + width / 2, y + 52, 6.8, yoyColor, 'bold', { align: 'center', maxWidth: width - 8 });
          text('Comparado ao acumulado do ano passado (mesmo período)', x + width / 2, y + 57.5, 5.2, MUTED, 'normal', { align: 'center', maxWidth: width - 8 });
          text(`Média Jan–${item.yoy.monthLabel}: ${formatKpi(item.yoy.avgCurrent, item.valueType, item.decimals)} · ${item.yoy.previousYear}: ${formatKpi(item.yoy.avgPrevious, item.valueType, item.decimals)}`, x + width / 2, y + 62.5, 5.6, MUTED, 'normal', { align: 'center', maxWidth: width - 8 });
        }
        const years = Array.from(new Set(item.history.map(point => point.label.slice(0, 4))))
          .filter(year => year === data.currentYear || year === data.previousYear)
          .sort();
        const colorOfYear = (year: string): RGB => (year === data.currentYear ? TEAL : [67, 139, 246]);
        const series = years.map(year => ({
          values: MONTHS.map((_, monthIndex) => item.history.find(point => point.label === `${year}-${String(monthIndex + 1).padStart(2, '0')}`)?.value ?? null),
          color: colorOfYear(year),
        }));
        if (lineChart(series, MONTHS, x + 8, y + 70, width - 16, 38, false)) {
          legend(years.map(year => ({ label: year, color: colorOfYear(year) })), x + width / 2 - years.length * 17 + 3, y + 119);
        } else {
          text('Histórico insuficiente para o gráfico anual', x + width / 2, y + 92, 6.5, MUTED, 'normal', { align: 'center', maxWidth: width - 10 });
        }
      });
    }

  }

  const conversionGroups = ['ativo', 'receptivo'].map(tipo => ({ tipo, rows: data.conversion.filter(row => normalized(row.tipo) === tipo) })).filter(group => group.rows.length);
  if (conversionGroups.length) {
    addPage('Comercial', 'Contatos, matrículas e conversão por origem');
    conversionGroups.forEach((group, index) => {
      const x = MX + index * 157; const contacts = group.rows.reduce((sum, row) => sum + row.contatos, 0); const enrollments = group.rows.reduce((sum, row) => sum + row.matriculas, 0); const rate = contacts ? enrollments / contacts * 100 : 0;
      text(group.tipo.toUpperCase(), x, 48, 14, ORANGE, 'bold');
      metric(x, 57, 44, 'Contatos', fmtNumber(contacts), TEAL); metric(x + 49, 57, 44, 'Matrículas', fmtNumber(enrollments), ORANGE); metric(x + 98, 57, 44, 'Conversão', `${fmtNumber(rate, 1)}%`, GREEN);
      lineChart([{ values: group.rows.map(row => row.contatos), color: TEAL }, { values: group.rows.map(row => row.matriculas), color: ORANGE }], group.rows.map(row => row.label), x, 103, 142, 45, true);
    });
  }

  annualComparisonPage('Matrículas por ano', data.annualEnrollments, 'count');
  annualComparisonPage('Contatos por ano', data.annualContacts, 'count');

  const totalPages = pdf.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    pdf.setPage(pageNumber); pdf.setDrawColor(...GRID); pdf.line(MX, PAGE_H - 10, PAGE_W - MX, PAGE_H - 10);
    text(`${data.schoolName} · ${data.periodoLabel} · Gerado em ${generatedAt}`, MX, PAGE_H - 5.5, 6.3, MUTED);
    text(`${pageNumber} / ${totalPages}`, PAGE_W - MX, PAGE_H - 5.5, 6.3, MUTED, 'normal', { align: 'right' });
  }
  pdf.save(`${data.fileName || 'relatorio-gerencial-conta-muito'}.pdf`);
}
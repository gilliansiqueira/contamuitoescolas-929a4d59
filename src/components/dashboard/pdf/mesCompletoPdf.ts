import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
export interface AnnualFinancialRow { year: string; months: (number | null)[] }
export interface SalesReportRow { month: string; method: string; brand?: string; value: number }
export interface LegacyKpiReportRow { month: string; lucratividade: number | null; inadimplencia: number | null; mediaAlunosTurma: number | null; alunosModalidade: number | null; evasao: number | null }
export interface ExpenseCeilingReportRow { category: string; ceiling: number; scope: string; parentGroup?: string | null; semester: string }
export interface ConversionThresholdReportRow { tipo: string; min: number | null; max: number | null; label: string }
export interface KpiReportRow {
  id: string; name: string; value: number | null; valueType: string; direction: 'higher_is_better' | 'lower_is_better'; decimals: number;
  status?: string; previousValue?: number | null; previousMonth?: string; variation?: number | null; history: { label: string; value: number }[];
}
export interface ConversionReportRow { month: string; label: string; tipo: string; contatos: number; matriculas: number; taxa: number }
export interface MesCompletoData {
  schoolName: string; periodoLabel: string; saldoInicial: number; saldoFinal: number; receitas: number; despesas: number; resultado: number;
  porTipo: { label: string; valor: number; classificacao: string }[]; recebiveis: MesCompletoRow[]; contasPagar: MesCompletoRow[];
  anterior?: { label: string; receitas: number; despesas: number; resultado: number; saldoFinal: number };
  monthly: MonthlyReportRow[]; annualRevenue: AnnualFinancialRow[]; annualExpenses: AnnualFinancialRow[];
  expenses: ExpenseReportRow[]; expenseDetailTotal: number; rawExpenseTotal: number; excludedExpenseRows: ExpenseExcludedRow[];
  monthlyRevenue: { month: string; value: number }[]; expenseCeilings: ExpenseCeilingReportRow[]; sales: SalesReportRow[];
  legacyKpis: LegacyKpiReportRow[]; kpis: KpiReportRow[]; conversion: ConversionReportRow[];
  conversionThresholds: ConversionThresholdReportRow[]; enrollmentsYoY: { label: string; current: number; previous: number }[];
  annualEnrollments: AnnualFinancialRow[]; annualContacts: AnnualFinancialRow[]; currentYear: string; previousYear: string;
  sources: string[]; fileName?: string;
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
  const lineChart = (series: { values: (number | null)[]; color: RGB }[], labels: string[], x: number, y: number, width: number, height: number, zeroBase = false) => {
    const points = series.flatMap(item => item.values).filter((value): value is number => value !== null);
    if (points.length < 2 || labels.length < 2) return false;
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
  const darkTable = (title: string, subtitle: string, head: string[][], body: (string | number)[][], columnStyles: Record<number, object> = {}) => {
    addPage(title, subtitle);
    autoTable(pdf, {
      startY: 43, head, body, theme: 'grid',
      headStyles: { fillColor: ORANGE, textColor: WHITE, fontStyle: 'bold', fontSize: 7.4 },
      bodyStyles: { fillColor: GRAPHITE_2, textColor: WHITE, lineColor: GRID, fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: [43, 61, 69] }, margin: { left: MX, right: MX, top: 40, bottom: 14 }, columnStyles,
      didDrawPage: hook => {
        if (hook.pageNumber > 1) {
          background();
          text(title.toUpperCase(), MX, 22, 20, WHITE, 'bold');
          pdf.setFillColor(...ORANGE); pdf.rect(MX, 28, PAGE_W - MX * 2, 1.5, 'F');
        }
      },
    });
    pageCount = pdf.getNumberOfPages();
  };
  const annualPages = (title: string, rows: AnnualFinancialRow[]) => {
    const validRows = rows.filter(row => row.months.filter(value => value !== null).length >= 2);
    for (let offset = 0; offset < validRows.length; offset += 4) {
      addPage(title, 'Comparação anual · meses sem informação permanecem vazios');
      const pageRows = validRows.slice(offset, offset + 4);
      pageRows.forEach((row, index) => {
        const single = pageRows.length === 1;
        const col = index % 2; const line = Math.floor(index / 2); const x = single ? MX : MX + col * 157; const y = 43 + line * 67;
        const cardWidth = single ? PAGE_W - MX * 2 : 145; const cardHeight = single ? 105 : 57;
        const values = row.months.filter((value): value is number => value !== null); const total = values.reduce((sum, value) => sum + value, 0);
        pdf.setFillColor(...GRAPHITE_2); pdf.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'F');
        text(row.year, x + 6, y + 10, 13, WHITE, 'bold'); text(`Total ${compactMoney(total)} · Média ${compactMoney(values.length ? total / values.length : 0)}`, x + 30, y + 10, 7, MUTED);
        lineChart([{ values: row.months, color: index === pageRows.length - 1 ? ORANGE : TEAL }], MONTHS, x + 7, y + 18, cardWidth - 14, cardHeight - 28, true);
      });
    }
  };

  // Capa e conciliação principal
  addPage();
  if (logo) { try { pdf.addImage(logo, 'PNG', MX, 14, 38, 20); } catch { /* logo opcional */ } }
  text(data.schoolName.toUpperCase(), PAGE_W / 2, 23, 25, WHITE, 'bold', { align: 'center' });
  text(`RELATÓRIO · ${data.periodoLabel.toUpperCase()}`, PAGE_W / 2, 34, 15, WHITE, 'bold', { align: 'center' });
  pdf.setFillColor(...ORANGE); pdf.rect(90, 42, PAGE_W - 180, 1.5, 'F');
  text(`SALDO INICIAL: ${fmtBRL(data.saldoInicial)}`, PAGE_W / 2, 58, 17, WHITE, 'bold', { align: 'center' });
  const operationsIn = data.monthly.reduce((sum, row) => sum + row.operacoesIn, 0);
  const operationsOut = data.monthly.reduce((sum, row) => sum + row.operacoesOut, 0);
  const coverItems = [
    ['Receitas', data.receitas, GREEN], ['Despesas', data.despesas, PINK],
    ['Resultado', data.resultado, data.resultado >= 0 ? TEAL : PINK], ['Operações de caixa', operationsIn - operationsOut, ORANGE],
  ] as const;
  coverItems.forEach((item, index) => metric(22 + index * 78, 76, 68, item[0], fmtBRL(item[1]), item[2]));
  pdf.setDrawColor(...ORANGE); pdf.setLineWidth(1.2); pdf.roundedRect(113, 125, 113, 28, 1, 1, 'S');
  text(`SALDO FINAL: ${fmtBRL(data.saldoFinal)}`, PAGE_W / 2, 143, 16, WHITE, 'bold', { align: 'center' });
  text(`Resultado ${fmtBRL(data.resultado)} · impacto líquido das operações ${fmtBRL(operationsIn - operationsOut)}`, PAGE_W / 2, 164, 8, MUTED, 'normal', { align: 'center' });

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
  const topExpense = [...data.expenses].sort((a, b) => b.valor - a.valor)[0];
  text('PRINCIPAL PONTO DE ATENÇÃO', MX, 137, 10, ORANGE, 'bold');
  text(topExpense ? `${topExpense.mae} concentra ${fmtBRL(topExpense.valor)} no período.` : 'Não há despesas detalhadas conciliadas para o período.', MX, 150, 13, WHITE, 'bold');

  annualPages('Evolução de receitas', data.annualRevenue);
  annualPages('Evolução de despesas', data.annualExpenses);

  addPage('Resultado e caixa', 'A diferença entre resultado e caixa está explicitada pelas operações');
  if (!lineChart([
    { values: data.monthly.map(row => row.resultado), color: ORANGE },
    { values: data.monthly.map(row => row.saldoFinal), color: TEAL },
  ], data.monthly.map(row => row.label), MX + 8, 53, 205, 75, true)) {
    const row = data.monthly[data.monthly.length - 1];
    metric(MX, 58, 92, 'Resultado do período', fmtBRL(row?.resultado ?? data.resultado), data.resultado >= 0 ? GREEN : PINK);
    metric(MX + 104, 58, 92, 'Saldo de fechamento', fmtBRL(row?.saldoFinal ?? data.saldoFinal), data.saldoFinal >= 0 ? TEAL : PINK);
  }
  metric(246, 52, 72, 'Operações de entrada', fmtBRL(operationsIn), GREEN);
  metric(246, 88, 72, 'Operações de saída', fmtBRL(operationsOut), PINK);
  metric(246, 124, 72, 'Impacto líquido', fmtBRL(operationsIn - operationsOut), ORANGE);

  const hasActualAndForecast = data.monthly.some(row => row.receitasRealizadas > 0 && row.receitasPrevistas > 0 || row.despesasRealizadas > 0 && row.despesasPrevistas > 0);
  if (hasActualAndForecast) {
    addPage('Realizado x previsto', 'Valores mantidos separados; nenhuma soma usa rótulo ambíguo');
    const latest = data.monthly[data.monthly.length - 1];
    metric(MX, 47, 68, 'Receita realizada', fmtBRL(latest.receitasRealizadas), GREEN);
    metric(MX + 76, 47, 68, 'Receita prevista', fmtBRL(latest.receitasPrevistas), TEAL);
    metric(MX + 152, 47, 68, 'Despesa realizada', fmtBRL(latest.despesasRealizadas), PINK);
    metric(MX + 228, 47, 68, 'Despesa prevista', fmtBRL(latest.despesasPrevistas), ORANGE);
    lineChart([
      { values: data.monthly.map(row => row.receitasRealizadas), color: GREEN },
      { values: data.monthly.map(row => row.receitasPrevistas), color: TEAL },
      { values: data.monthly.map(row => row.despesasRealizadas), color: PINK },
      { values: data.monthly.map(row => row.despesasPrevistas), color: ORANGE },
    ], data.monthly.map(row => row.label), MX + 6, 95, PAGE_W - MX * 2 - 12, 55, true);
  }

  const salesMethods = new Map<string, number>(); data.sales.forEach(row => salesMethods.set(row.method, (salesMethods.get(row.method) ?? 0) + row.value));
  if (data.porTipo.some(row => row.classificacao === 'receita') || salesMethods.size) {
    addPage('Receitas recebidas e vendas', 'São medidas distintas e não são somadas entre si');
    text('RECEITAS RECEBIDAS POR TIPO', MX, 47, 10, ORANGE, 'bold');
    bars(data.porTipo.filter(row => row.classificacao === 'receita').map(row => ({ label: row.label, value: row.valor, color: GREEN })).sort((a, b) => b.value - a.value), MX, 60, 138, 7);
    text('VENDAS POR MEIO DE PAGAMENTO', 181, 47, 10, ORANGE, 'bold');
    bars([...salesMethods.entries()].map(([label, value]) => ({ label, value, color: TEAL })).sort((a, b) => b.value - a.value), 181, 60, 138, 7);
  }

  const motherMap = new Map<string, number>(); data.expenses.forEach(row => motherMap.set(row.mae, (motherMap.get(row.mae) ?? 0) + row.valor));
  const mothers = [...motherMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const revenueTotal = data.monthlyRevenue.filter(row => data.monthly.some(month => month.month === row.month)).reduce((sum, row) => sum + row.value, 0);
  if (mothers.length) {
    addPage('Saídas por categoria', 'Detalhamento conciliado com a despesa oficial do relatório');
    metric(MX, 43, 88, 'Despesa oficial', fmtBRL(data.despesas), PINK);
    metric(MX + 99, 43, 88, 'Detalhamento conciliado', fmtBRL(data.expenseDetailTotal), TEAL);
    metric(MX + 198, 43, 88, 'Sobre faturamento', revenueTotal ? `${fmtNumber(data.expenseDetailTotal / revenueTotal * 100, 1)}%` : '—', ORANGE);
    bars(mothers.map((row, index) => ({ ...row, color: index === 0 ? ORANGE : TEAL })), MX, 87, PAGE_W - MX * 2, 7);

    mothers.slice(0, 8).forEach(mother => {
      const rows = data.expenses.filter(row => row.mae === mother.label).sort((a, b) => b.valor - a.valor);
      addPage(`Despesas · ${mother.label}`, 'Principais subcategorias do período');
      metric(MX, 43, 88, 'Total da categoria', fmtBRL(mother.value), PINK);
      metric(MX + 99, 43, 88, 'Participação', data.expenseDetailTotal ? `${fmtNumber(mother.value / data.expenseDetailTotal * 100, 1)}%` : '—', ORANGE);
      metric(MX + 198, 43, 88, 'Subcategorias', fmtNumber(rows.length), TEAL);
      bars(rows.map(row => ({ label: row.filha, value: row.valor })), MX, 88, PAGE_W - MX * 2, 7);
    });
  }

  if (data.kpis.some(item => item.value !== null)) {
    const activeKpis = data.kpis.filter(item => item.value !== null);
    for (let offset = 0; offset < activeKpis.length; offset += 8) {
      addPage('Indicadores de gestão', 'Valor atual, faixa e leitura da evolução');
      activeKpis.slice(offset, offset + 8).forEach((item, index) => {
        const col = index % 4; const row = Math.floor(index / 4); const x = MX + col * 76; const y = 45 + row * 59;
        const delta = item.value !== null && item.previousValue != null ? item.value - item.previousValue : null;
        const improved = delta === null ? null : item.direction === 'higher_is_better' ? delta > 0 : delta < 0;
        const note = [item.status, delta === null ? '' : `${delta > 0 ? '↑' : delta < 0 ? '↓' : '→'} ${improved ? 'melhora' : delta === 0 ? 'estável' : 'atenção'} vs ${item.previousMonth ?? 'anterior'}`].filter(Boolean).join(' · ');
        metric(x, y, 68, item.name, formatKpi(item.value, item.valueType, item.decimals), improved === false ? PINK : improved === true ? GREEN : TEAL, note);
        if (item.history.length > 1) lineChart([{ values: item.history.slice(-6).map(point => point.value), color: ORANGE }], item.history.slice(-6).map(point => point.label.slice(5)), x + 2, y + 34, 64, 15, false);
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

  annualPages('Matrículas por ano', data.annualEnrollments);
  annualPages('Contatos por ano', data.annualContacts);

  if (data.expenses.length) darkTable('Conferência de despesas', 'Categorias e subcategorias que compõem a despesa oficial', [['Categoria-mãe', 'Subcategoria', 'Valor', '%']], data.expenses.map(row => [row.mae, row.filha, fmtBRL(row.valor), data.expenseDetailTotal ? `${fmtNumber(row.valor / data.expenseDetailTotal * 100, 1)}%` : '—']), { 2: { halign: 'right' }, 3: { halign: 'right' } });
  if (data.excludedExpenseRows.length) darkTable('Conciliação do arquivo realizado', `${fmtBRL(data.rawExpenseTotal - data.expenseDetailTotal)} não compõe a despesa oficial; linhas responsáveis abaixo`, [['Data', 'Descrição', 'Conta', 'Valor', 'Motivo']], data.excludedExpenseRows.map(row => [row.date.split('-').reverse().join('/'), row.description, row.account, fmtBRL(row.value), row.reason]), { 3: { halign: 'right' } });
  if (data.monthly.length) darkTable('Conferência financeira mensal', 'Valores preparados pelos motores financeiros oficiais', [['Mês', 'Fonte', 'Saldo inicial', 'Receitas', 'Despesas', 'Oper. entrada', 'Oper. saída', 'Resultado', 'Saldo final']], data.monthly.map(row => [row.label, row.source, fmtBRL(row.saldoInicial), fmtBRL(row.receitas), fmtBRL(row.despesas), fmtBRL(row.operacoesIn), fmtBRL(row.operacoesOut), fmtBRL(row.resultado), fmtBRL(row.saldoFinal)]), { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' } });

  const totalPages = pdf.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    pdf.setPage(pageNumber); pdf.setDrawColor(...GRID); pdf.line(MX, PAGE_H - 10, PAGE_W - MX, PAGE_H - 10);
    text(`${data.schoolName} · ${data.periodoLabel} · Gerado em ${generatedAt}`, MX, PAGE_H - 5.5, 6.3, MUTED);
    text(`${pageNumber} / ${totalPages}`, PAGE_W - MX, PAGE_H - 5.5, 6.3, MUTED, 'normal', { align: 'right' });
  }
  pdf.save(`${data.fileName || 'relatorio-gerencial-conta-muito'}.pdf`);
}
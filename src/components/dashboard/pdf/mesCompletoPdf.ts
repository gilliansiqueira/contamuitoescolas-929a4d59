import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import contaMuitoLogo from '@/assets/logo-conta-muito.png';

const fmtBRL = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNumber = (v: number, decimals = 0) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const PRIMARY: [number, number, number] = [15, 118, 110];
const TEAL: [number, number, number] = [14, 165, 164];
const ACCENT: [number, number, number] = [245, 158, 11];
const TEXT: [number, number, number] = [24, 38, 47];
const MUTED: [number, number, number] = [100, 116, 139];
const BORDER: [number, number, number] = [220, 230, 232];
const SURFACE: [number, number, number] = [246, 249, 249];
const SUCCESS: [number, number, number] = [16, 150, 110];
const DANGER: [number, number, number] = [225, 73, 104];
const WHITE: [number, number, number] = [255, 255, 255];
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN_X = 14;
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

type RGB = [number, number, number];
export interface MesCompletoRow { label: string; valor: number; sub?: string }
export interface MonthlyReportRow { month: string; label: string; source: string; saldoInicial: number; receitas: number; despesas: number; resultado: number; operacoesIn: number; operacoesOut: number; saldoFinal: number }
export interface ExpenseReportRow { mae: string; filha: string; valor: number }
export interface AnnualFinancialRow { year: string; months: (number | null)[] }
export interface SalesReportRow { month: string; method: string; brand?: string; value: number }
export interface LegacyKpiReportRow { month: string; lucratividade: number | null; inadimplencia: number | null; mediaAlunosTurma: number | null; alunosModalidade: number | null; evasao: number | null }
export interface ExpenseCeilingReportRow { category: string; ceiling: number; scope: string; parentGroup?: string | null; semester: string }
export interface ConversionThresholdReportRow { tipo: string; min: number | null; max: number | null; label: string }
export interface KpiReportRow { id: string; name: string; value: number | null; valueType: string; decimals: number; status?: string; variation?: number | null; history: { label: string; value: number }[] }
export interface ConversionReportRow { month: string; label: string; tipo: string; contatos: number; matriculas: number; taxa: number }
export interface MesCompletoData {
  schoolName: string; periodoLabel: string; saldoInicial: number; saldoFinal: number; receitas: number; despesas: number; resultado: number;
  porTipo: { label: string; valor: number; classificacao: string }[]; recebiveis: MesCompletoRow[]; contasPagar: MesCompletoRow[];
  anterior?: { label: string; receitas: number; despesas: number; resultado: number; saldoFinal: number };
  monthly: MonthlyReportRow[]; annualRevenue: AnnualFinancialRow[]; annualExpenses: AnnualFinancialRow[];
  expenses: ExpenseReportRow[]; expenseDetailTotal: number; monthlyRevenue: { month: string; value: number }[];
  expenseCeilings: ExpenseCeilingReportRow[]; sales: SalesReportRow[]; legacyKpis: LegacyKpiReportRow[]; kpis: KpiReportRow[];
  conversion: ConversionReportRow[]; conversionThresholds: ConversionThresholdReportRow[];
  enrollmentsYoY: { label: string; current: number; previous: number }[]; annualEnrollments: AnnualFinancialRow[]; annualContacts: AnnualFinancialRow[];
  currentYear: string; previousYear: string; sources: string[]; fileName?: string;
}

async function loadLogo(): Promise<string | null> {
  try {
    const blob = await fetch(contaMuitoLogo).then(response => response.blob());
    return await new Promise(resolve => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result as string); reader.readAsDataURL(blob); });
  } catch { return null; }
}

function formatKpi(value: number | null, type: string, decimals: number) {
  if (value === null) return '—';
  if (type === 'currency') return fmtBRL(value);
  if (type === 'percent') return `${fmtNumber(value, decimals)}%`;
  return fmtNumber(value, decimals);
}

function compactMoney(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${fmtNumber(value / 1_000_000, 1)} mi`;
  if (abs >= 1_000) return `R$ ${fmtNumber(value / 1_000, 0)} mil`;
  return fmtBRL(value);
}

export async function generateMesCompletoPdf(data: MesCompletoData) {
  const pdf = new jsPDF('l', 'mm', 'a4');
  const logo = await loadLogo();
  const generatedAt = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  let y = 0;

  const header = (title: string, subtitle = data.periodoLabel) => {
    pdf.setFillColor(...PRIMARY); pdf.rect(0, 0, PAGE_W, 25, 'F');
    pdf.setFillColor(...ACCENT); pdf.rect(0, 25, PAGE_W, 1.2, 'F');
    if (logo) { try { pdf.addImage(logo, 'PNG', MARGIN_X, 5, 30, 14); } catch { /* optional */ } }
    pdf.setTextColor(...WHITE); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.text(title, logo ? 50 : MARGIN_X, 11);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.text(subtitle, logo ? 50 : MARGIN_X, 17);
    pdf.setFont('helvetica', 'bold'); pdf.text(data.schoolName, PAGE_W - MARGIN_X, 10, { align: 'right' });
    pdf.setFont('helvetica', 'normal'); pdf.text(data.periodoLabel, PAGE_W - MARGIN_X, 17, { align: 'right' });
    y = 35;
  };

  const page = (title: string, subtitle?: string) => { if (pdf.getNumberOfPages() > 0 && y > 0) pdf.addPage('a4', 'landscape'); header(title, subtitle); };
  const section = (title: string, note?: string) => {
    pdf.setFillColor(...ACCENT); pdf.rect(MARGIN_X, y - 4, 1.5, 6, 'F');
    pdf.setTextColor(...TEXT); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10.5); pdf.text(title, MARGIN_X + 4, y);
    if (note) { pdf.setTextColor(...MUTED); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.text(note, PAGE_W - MARGIN_X, y, { align: 'right' }); }
    y += 7;
  };
  const empty = (text = 'Sem dados cadastrados no período.') => { pdf.setTextColor(...MUTED); pdf.setFont('helvetica', 'italic'); pdf.setFontSize(8.5); pdf.text(text, MARGIN_X, y + 6); y += 16; };
  const table = (opts: Parameters<typeof autoTable>[1]) => {
    const startPage = pdf.getCurrentPageInfo().pageNumber;
    autoTable(pdf, {
      startY: y, theme: 'grid', headStyles: { fillColor: PRIMARY, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 7, textColor: TEXT, cellPadding: 1.4 }, alternateRowStyles: { fillColor: SURFACE },
      margin: { left: MARGIN_X, right: MARGIN_X, top: 32, bottom: 14 }, ...opts,
      didDrawPage: hook => {
        if (pdf.getCurrentPageInfo().pageNumber > startPage) header('ANEXO · CONTINUAÇÃO', data.periodoLabel);
        opts.didDrawPage?.(hook);
      },
    });
    y = (pdf as any).lastAutoTable.finalY + 7;
  };
  const metric = (x: number, top: number, width: number, label: string, value: string, color: RGB, note?: string) => {
    pdf.setFillColor(...SURFACE); pdf.setDrawColor(...BORDER); pdf.roundedRect(x, top, width, 24, 1.5, 1.5, 'FD');
    pdf.setFillColor(...color); pdf.rect(x, top, 1.8, 24, 'F');
    pdf.setTextColor(...MUTED); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5); pdf.text(label.toUpperCase(), x + 5, top + 7);
    pdf.setTextColor(...color); pdf.setFontSize(11); let size = 11; while (pdf.getTextWidth(value) > width - 9 && size > 7) { size -= .5; pdf.setFontSize(size); }
    pdf.text(value, x + 5, top + 15);
    if (note) { pdf.setTextColor(...MUTED); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6); pdf.text(note, x + 5, top + 20.5); }
  };
  const bars = (items: { label: string; value: number; color?: RGB }[], x: number, top: number, width: number, maxRows = 8) => {
    const rows = items.slice(0, maxRows); const max = Math.max(...rows.map(item => item.value), 1);
    rows.forEach((item, index) => {
      const yy = top + index * 10; pdf.setTextColor(...TEXT); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.2); pdf.text(item.label.slice(0, 38), x, yy);
      pdf.setFont('helvetica', 'bold'); pdf.text(fmtBRL(item.value), x + width, yy, { align: 'right' });
      pdf.setFillColor(...BORDER); pdf.roundedRect(x, yy + 2, width, 2.2, 1, 1, 'F'); pdf.setFillColor(...(item.color || TEAL)); pdf.roundedRect(x, yy + 2, Math.max(.7, width * item.value / max), 2.2, 1, 1, 'F');
    });
  };
  const lineChart = (series: { label: string; values: (number | null)[]; color: RGB }[], labels: string[], x: number, top: number, width: number, height: number, zeroBase = false) => {
    const values = series.flatMap(item => item.values).filter((value): value is number => value !== null);
    if (!values.length) return false;
    const min = zeroBase ? Math.min(0, ...values) : Math.min(...values);
    const max = Math.max(...values); const padding = Math.max((max - min) * .1, 1); const low = zeroBase ? min : min - padding; const high = max + padding; const span = high - low || 1;
    pdf.setDrawColor(...BORDER); pdf.setLineWidth(.2);
    for (let index = 0; index <= 4; index++) { const gy = top + height * index / 4; pdf.line(x, gy, x + width, gy); }
    labels.forEach((label, index) => { const px = labels.length === 1 ? x + width / 2 : x + index * width / (labels.length - 1); pdf.setTextColor(...MUTED); pdf.setFontSize(6); pdf.text(label, px, top + height + 4, { align: 'center' }); });
    series.forEach(item => {
      pdf.setDrawColor(...item.color); pdf.setFillColor(...item.color); pdf.setLineWidth(.8); let previous: { x: number; y: number } | null = null;
      item.values.forEach((value, index) => {
        if (value === null) { previous = null; return; }
        const px = item.values.length === 1 ? x + width / 2 : x + index * width / (item.values.length - 1); const py = top + height - ((value - low) / span) * height;
        if (previous) pdf.line(previous.x, previous.y, px, py); pdf.circle(px, py, 1, 'F'); previous = { x: px, y: py };
      });
    });
    return true;
  };
  const smallMultiples = (title: string, rows: AnnualFinancialRow[], formatter: (value: number) => string) => {
    page(title, 'Histórico anual — meses sem dados permanecem em branco');
    if (!rows.length) { empty(); return; }
    const chartW = 126; const chartH = 42; const rowH = 69;
    rows.forEach((row, index) => {
      if (index > 0 && index % 4 === 0) page(`${title} · CONTINUAÇÃO`, 'Histórico anual');
      const local = index % 4; const col = local % 2; const line = Math.floor(local / 2); const x = MARGIN_X + col * 137; const top = 36 + line * rowH;
      const actual = row.months.filter((value): value is number => value !== null); const total = actual.reduce((sum, value) => sum + value, 0);
      pdf.setFillColor(...SURFACE); pdf.setDrawColor(...BORDER); pdf.roundedRect(x, top, chartW + 5, 61, 1.4, 1.4, 'FD');
      pdf.setTextColor(...TEXT); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.text(row.year, x + 5, top + 8);
      pdf.setFontSize(6.5); pdf.setTextColor(...MUTED); pdf.text(`Total ${formatter(total)}  ·  Média ${formatter(actual.length ? total / actual.length : 0)}`, x + 25, top + 8);
      lineChart([{ label: row.year, values: row.months, color: row.year === rows[rows.length - 1]?.year ? ACCENT : TEAL }], MONTHS, x + 5, top + 14, chartW - 5, chartH - 7, true);
    });
  };

  // 1 — Resumo executivo
  header('RELATÓRIO EXECUTIVO CONSOLIDADO', 'Leitura financeira e gerencial para tomada de decisão');
  const cardW = 51.8;
  [["Saldo inicial", data.saldoInicial, PRIMARY], ["Receitas", data.receitas, SUCCESS], ["Despesas", data.despesas, DANGER], ["Resultado", data.resultado, data.resultado >= 0 ? SUCCESS : DANGER], ["Saldo final", data.saldoFinal, data.saldoFinal >= 0 ? PRIMARY : DANGER]].forEach((card, index) => metric(MARGIN_X + index * (cardW + 2.8), y, cardW, card[0] as string, fmtBRL(card[1] as number), card[2] as RGB));
  y += 34; section('Visão do período', `Fontes: ${data.sources.join(' + ') || 'Sem fonte identificada'}`);
  if (data.monthly.length) { lineChart([{ label: 'Receitas', values: data.monthly.map(row => row.receitas), color: SUCCESS }, { label: 'Despesas', values: data.monthly.map(row => row.despesas), color: DANGER }, { label: 'Resultado', values: data.monthly.map(row => row.resultado), color: ACCENT }], data.monthly.map(row => row.label), MARGIN_X + 4, y + 2, 260, 48, true); y += 62; } else empty();
  section('Leitura gerencial');
  const margin = data.receitas ? data.resultado / data.receitas * 100 : 0; const expenseWeight = data.receitas ? data.despesas / data.receitas * 100 : 0;
  const insights = [
    { title: 'MARGEM DO RESULTADO', value: `${fmtNumber(margin, 1)}%`, note: margin >= 0 ? 'Resultado positivo no período' : 'Resultado negativo no período', color: margin >= 0 ? SUCCESS : DANGER },
    { title: 'PESO DAS DESPESAS', value: `${fmtNumber(expenseWeight, 1)}%`, note: 'Participação sobre as receitas', color: expenseWeight <= 100 ? TEAL : DANGER },
    { title: 'VARIAÇÃO DO CAIXA', value: fmtBRL(data.saldoFinal - data.saldoInicial), note: 'Saldo final menos saldo inicial', color: data.saldoFinal >= data.saldoInicial ? SUCCESS : ACCENT },
  ];
  insights.forEach((item, index) => metric(MARGIN_X + index * 91.5, y, 86, item.title, item.value, item.color, item.note));

  smallMultiples('HISTÓRICO DE RECEITAS', data.annualRevenue, compactMoney);
  smallMultiples('HISTÓRICO DE DESPESAS', data.annualExpenses, compactMoney);

  // 4 — Caixa
  page('RESULTADO E EVOLUÇÃO DO CAIXA', 'Movimentação mensal do período selecionado'); section('Resultado mensal e saldo de fechamento');
  if (data.monthly.length) { lineChart([{ label: 'Resultado', values: data.monthly.map(row => row.resultado), color: ACCENT }, { label: 'Saldo final', values: data.monthly.map(row => row.saldoFinal), color: PRIMARY }], data.monthly.map(row => row.label), MARGIN_X + 5, y + 2, 258, 54, true); y += 68; table({ head: [['Mês', 'Fonte', 'Saldo inicial', 'Receitas', 'Despesas', 'Oper. entrada', 'Oper. saída', 'Resultado', 'Saldo final']], body: data.monthly.map(row => [row.label, row.source, fmtBRL(row.saldoInicial), fmtBRL(row.receitas), fmtBRL(row.despesas), fmtBRL(row.operacoesIn), fmtBRL(row.operacoesOut), fmtBRL(row.resultado), fmtBRL(row.saldoFinal)]), styles: { fontSize: 6.4 }, columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' } } }); } else empty();

  // 5 — Folha, alunos e lucratividade
  page('FOLHA, ALUNOS E LUCRATIVIDADE', 'Escalas separadas para leitura correta');
  const folhaKpi = data.kpis.find(item => item.name.toLocaleLowerCase('pt-BR').includes('folha'));
  const alunosKpi = data.kpis.find(item => { const name = item.name.toLocaleLowerCase('pt-BR'); return name.includes('alunos') && !name.includes('turma'); });
  const legacyMonths = data.legacyKpis.filter(row => data.monthly.some(month => month.month === row.month));
  section('Gastos com folha'); if (folhaKpi?.history.length) { lineChart([{ label: 'Folha', values: folhaKpi.history.map(item => item.value), color: ACCENT }], folhaKpi.history.map(item => item.label.slice(5)), MARGIN_X + 5, y, 258, 28, true); y += 41; } else empty('Sem indicador de folha cadastrado no período.');
  section('Quantidade de alunos'); if (alunosKpi?.history.length) { lineChart([{ label: 'Alunos', values: alunosKpi.history.map(item => item.value), color: TEAL }], alunosKpi.history.map(item => item.label.slice(5)), MARGIN_X + 5, y, 258, 28, true); y += 41; } else empty('Sem indicador de total de alunos cadastrado no período.');
  section('Lucratividade'); if (legacyMonths.some(row => row.lucratividade !== null)) { lineChart([{ label: 'Lucratividade', values: legacyMonths.map(row => row.lucratividade), color: SUCCESS }], legacyMonths.map(row => row.month.slice(5)), MARGIN_X + 5, y, 258, 28, true); } else empty('Sem dados de lucratividade cadastrados no período.');

  // 6 — Vendas
  page('VENDAS', 'Composição por forma de pagamento oficial');
  const salesTotal = data.sales.reduce((sum, row) => sum + row.value, 0); const salesMethods = new Map<string, number>(); const salesBrands = new Map<string, number>();
  data.sales.forEach(row => { salesMethods.set(row.method, (salesMethods.get(row.method) || 0) + row.value); if (row.brand) salesBrands.set(row.brand, (salesBrands.get(row.brand) || 0) + row.value); });
  metric(MARGIN_X, y, 83, 'Total de vendas', fmtBRL(salesTotal), PRIMARY, data.periodoLabel);
  metric(MARGIN_X + 91, y, 83, 'Maior canal', [...salesMethods.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—', ACCENT);
  metric(MARGIN_X + 182, y, 83, 'Formas com movimento', fmtNumber(salesMethods.size), TEAL); y += 34;
  section('Participação por forma de pagamento');
  if (salesMethods.size) { bars([...salesMethods.entries()].map(([label, value], index) => ({ label, value, color: index === 0 ? ACCENT : TEAL })).sort((a, b) => b.value - a.value), MARGIN_X, y + 2, 125, 8); bars([...salesBrands.entries()].map(([label, value]) => ({ label, value, color: PRIMARY })).sort((a, b) => b.value - a.value), 158, y + 2, 125, 8); y += 90; } else empty();
  section('Vendas por mês e forma');
  if (data.sales.length) table({ head: [['Mês', 'Forma', 'Bandeira', 'Valor']], body: data.sales.map(row => [row.month, row.method, row.brand || '—', fmtBRL(row.value)]), columnStyles: { 3: { halign: 'right' } } }); else empty();

  // 7 — Despesas
  page('DESPESAS E FATURAMENTO', 'Categorias-mãe, concentração e limites cadastrados');
  const motherMap = new Map<string, number>(); data.expenses.forEach(row => motherMap.set(row.mae, (motherMap.get(row.mae) || 0) + row.valor));
  const mothers = [...motherMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value); const revenueTotal = data.monthlyRevenue.filter(row => data.monthly.some(month => month.month === row.month)).reduce((sum, row) => sum + row.value, 0);
  metric(MARGIN_X, y, 83, 'Despesas detalhadas', fmtBRL(data.expenseDetailTotal), DANGER); metric(MARGIN_X + 91, y, 83, 'Faturamento informado', fmtBRL(revenueTotal), PRIMARY); metric(MARGIN_X + 182, y, 83, 'Peso sobre faturamento', revenueTotal ? `${fmtNumber(data.expenseDetailTotal / revenueTotal * 100, 1)}%` : '—', ACCENT); y += 34;
  section('Ranking das categorias-mãe'); if (mothers.length) { bars(mothers.map((item, index) => ({ ...item, color: index === 0 ? ACCENT : TEAL })), MARGIN_X, y + 2, 260, 10); y += Math.min(mothers.length, 10) * 10 + 7; } else empty();
  if (data.expenseCeilings.length) { section('Limites de gastos cadastrados'); table({ head: [['Semestre', 'Categoria', 'Escopo', 'Limite']], body: data.expenseCeilings.map(row => [row.semester, row.parentGroup ? `${row.parentGroup} › ${row.category}` : row.category, row.scope === 'subcategory' ? 'Subcategoria' : 'Categoria-mãe', fmtBRL(row.ceiling)]), columnStyles: { 3: { halign: 'right' } } }); }

  mothers.forEach(mother => {
    page(`DESPESAS · ${mother.label.toUpperCase()}`, 'Detalhamento por subcategoria');
    const rows = data.expenses.filter(row => row.mae === mother.label).sort((a, b) => b.valor - a.valor);
    metric(MARGIN_X, y, 83, 'Total da categoria', fmtBRL(mother.value), DANGER); metric(MARGIN_X + 91, y, 83, 'Participação', data.expenseDetailTotal ? `${fmtNumber(mother.value / data.expenseDetailTotal * 100, 1)}%` : '—', ACCENT); metric(MARGIN_X + 182, y, 83, 'Subcategorias', fmtNumber(rows.length), TEAL); y += 34;
    bars(rows.map(row => ({ label: row.filha, value: row.valor })), MARGIN_X, y, 125, 10);
    table({ startY: y, margin: { left: 158, right: MARGIN_X, top: 32, bottom: 14 }, head: [['Subcategoria', 'Valor', '% categoria']], body: rows.map(row => [row.filha, fmtBRL(row.valor), mother.value ? `${fmtNumber(row.valor / mother.value * 100, 1)}%` : '—']), columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } });
  });

  // 8 — KPIs
  page('INDICADORES DE GESTÃO', 'Valores atuais, faixas e evolução individual');
  if (data.kpis.length) {
    data.kpis.slice(0, 8).forEach((item, index) => { const col = index % 4; const row = Math.floor(index / 4); metric(MARGIN_X + col * 68, 36 + row * 31, 63, item.name, formatKpi(item.value, item.valueType, item.decimals), item.status ? ACCENT : TEAL, [item.status, item.variation == null ? '' : `${item.variation >= 0 ? '+' : ''}${fmtNumber(item.variation, 1)}% vs anterior`].filter(Boolean).join(' · ')); });
    y = 103; section('Evolução dos indicadores');
    const chartItems = data.kpis.filter(item => item.history.length > 1).slice(0, 4); chartItems.forEach((item, index) => { const x = MARGIN_X + (index % 2) * 137; const top = y + Math.floor(index / 2) * 38; pdf.setTextColor(...TEXT); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.text(item.name, x, top); lineChart([{ label: item.name, values: item.history.map(point => point.value), color: index % 2 ? ACCENT : TEAL }], item.history.map(point => point.label.slice(5)), x, top + 3, 126, 25, false); });
  } else empty();

  page('INDICADORES · HISTÓRICO E INADIMPLÊNCIA', 'Tabela completa de conferência'); section('Indicadores configuráveis');
  if (data.kpis.length) table({ head: [['Indicador', 'Valor', 'Classificação', 'Variação']], body: data.kpis.map(item => [item.name, formatKpi(item.value, item.valueType, item.decimals), item.status || '—', item.variation == null ? '—' : `${item.variation >= 0 ? '+' : ''}${fmtNumber(item.variation, 1)}%`]), columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } } }); else empty();
  section('Inadimplência'); const delinquency = data.legacyKpis.filter(row => row.inadimplencia !== null); if (delinquency.length) { lineChart([{ label: 'Inadimplência', values: delinquency.map(row => row.inadimplencia), color: DANGER }], delinquency.map(row => row.month), MARGIN_X + 5, y + 2, 258, 37, true); } else empty('Sem dados de inadimplência cadastrados.');

  // 9 — Comercial
  page('COMERCIAL · ATIVO E RECEPTIVO', 'Contatos, matrículas e conversão por origem');
  const conversionByType = ['ativo', 'receptivo'].map(tipo => ({ tipo, rows: data.conversion.filter(row => row.tipo === tipo) }));
  conversionByType.forEach((group, index) => {
    const x = MARGIN_X + index * 137; const contacts = group.rows.reduce((sum, row) => sum + row.contatos, 0); const enrollments = group.rows.reduce((sum, row) => sum + row.matriculas, 0); const rate = contacts ? enrollments / contacts * 100 : 0;
    pdf.setTextColor(...TEXT); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.text(group.tipo.toUpperCase(), x, y);
    metric(x, y + 6, 39, 'Contatos', fmtNumber(contacts), TEAL); metric(x + 43, y + 6, 39, 'Matrículas', fmtNumber(enrollments), ACCENT); metric(x + 86, y + 6, 39, 'Conversão', `${fmtNumber(rate, 1)}%`, rate > 0 ? SUCCESS : MUTED);
    const threshold = data.conversionThresholds.find(item => item.tipo === group.tipo && (item.min === null || rate >= item.min) && (item.max === null || rate < item.max));
    pdf.setTextColor(...MUTED); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.text(threshold ? `Faixa: ${threshold.label}` : 'Sem faixa configurada', x, y + 35);
    if (group.rows.length) lineChart([{ label: 'Contatos', values: group.rows.map(row => row.contatos), color: TEAL }, { label: 'Matrículas', values: group.rows.map(row => row.matriculas), color: ACCENT }], group.rows.map(row => row.label), x, y + 42, 126, 48, true);
    else { pdf.setFont('helvetica', 'italic'); pdf.text('Sem dados cadastrados no período.', x, y + 55); }
  });

  smallMultiples('MATRÍCULAS POR ANO', data.annualEnrollments, value => fmtNumber(value));
  smallMultiples('CONTATOS POR ANO', data.annualContacts, value => fmtNumber(value));

  // Anexos
  page('ANEXO · DESPESAS DETALHADAS', 'Categorias-mãe e subcategorias');
  if (data.expenses.length) table({ head: [['Categoria-mãe', 'Subcategoria', 'Valor', '% detalhado']], body: data.expenses.map(row => [row.mae, row.filha, fmtBRL(row.valor), data.expenseDetailTotal ? `${fmtNumber(row.valor / data.expenseDetailTotal * 100, 1)}%` : '—']), columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } } }); else empty();
  page('ANEXO · CONVERSÃO', 'Dados mensais por origem');
  if (data.conversion.length) table({ head: [['Mês', 'Origem', 'Contatos', 'Matrículas', 'Conversão']], body: data.conversion.map(row => [row.label, row.tipo, fmtNumber(row.contatos), fmtNumber(row.matriculas), `${fmtNumber(row.taxa, 1)}%`]), columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } } }); else empty();

  const totalPages = pdf.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    pdf.setPage(pageNumber); pdf.setDrawColor(...BORDER); pdf.setLineWidth(.2); pdf.line(MARGIN_X, PAGE_H - 10, PAGE_W - MARGIN_X, PAGE_H - 10);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(...MUTED); pdf.text(`${data.schoolName} · ${data.periodoLabel} · Gerado em ${generatedAt}`, MARGIN_X, PAGE_H - 6); pdf.text(`Página ${pageNumber} de ${totalPages}`, PAGE_W - MARGIN_X, PAGE_H - 6, { align: 'right' });
  }
  pdf.save(`${data.fileName || 'relatorio-executivo-conta-muito'}.pdf`);
}

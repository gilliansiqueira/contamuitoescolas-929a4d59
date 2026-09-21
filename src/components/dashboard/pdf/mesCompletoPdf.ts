import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import contaMuitoLogo from '@/assets/logo-conta-muito.png';

const fmtBRL = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNumber = (v: number, decimals = 0) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const PRIMARY: [number, number, number] = [14, 165, 164];
const PRIMARY_DARK: [number, number, number] = [15, 118, 110];
const ACCENT: [number, number, number] = [245, 158, 11];
const TEXT: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const BORDER: [number, number, number] = [226, 232, 240];
const SURFACE: [number, number, number] = [248, 250, 252];
const SUCCESS: [number, number, number] = [16, 185, 129];
const DANGER: [number, number, number] = [225, 73, 104];
const WHITE: [number, number, number] = [255, 255, 255];
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 15;

export interface MesCompletoRow { label: string; valor: number; sub?: string }
export interface MonthlyReportRow {
  month: string; label: string; source: string; saldoInicial: number; receitas: number; despesas: number; resultado: number; saldoFinal: number;
}
export interface ExpenseReportRow { mae: string; filha: string; valor: number }
export interface KpiReportRow {
  id: string; name: string; value: number | null; valueType: string; decimals: number; status?: string; variation?: number | null; history: { label: string; value: number }[];
}
export interface ConversionReportRow { month: string; label: string; tipo: string; contatos: number; matriculas: number; taxa: number }

export interface MesCompletoData {
  schoolName: string;
  periodoLabel: string;
  saldoInicial: number;
  saldoFinal: number;
  receitas: number;
  despesas: number;
  resultado: number;
  porTipo: { label: string; valor: number; classificacao: string }[];
  recebiveis: MesCompletoRow[];
  contasPagar: MesCompletoRow[];
  anterior?: { label: string; receitas: number; despesas: number; resultado: number; saldoFinal: number };
  monthly: MonthlyReportRow[];
  expenses: ExpenseReportRow[];
  expenseDetailTotal: number;
  kpis: KpiReportRow[];
  conversion: ConversionReportRow[];
  enrollmentsYoY: { label: string; current: number; previous: number }[];
  currentYear: string;
  previousYear: string;
  sources: string[];
  fileName?: string;
}

async function loadLogo(): Promise<string | null> {
  try {
    const blob = await fetch(contaMuitoLogo).then(r => r.blob());
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
  const pdf = new jsPDF('p', 'mm', 'a4');
  const logo = await loadLogo();
  const generatedAt = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  let y = 0;

  const addBrandHeader = (title: string, subtitle?: string) => {
    pdf.setFillColor(...PRIMARY_DARK);
    pdf.rect(0, 0, PAGE_W, 31, 'F');
    pdf.setFillColor(...ACCENT);
    pdf.rect(0, 31, PAGE_W, 1.4, 'F');
    if (logo) {
      try { pdf.addImage(logo, 'PNG', MARGIN_X, 7, 34, 16); } catch { /* optional */ }
    }
    pdf.setTextColor(...WHITE);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text(title, logo ? 55 : MARGIN_X, 14);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(subtitle || data.periodoLabel, logo ? 55 : MARGIN_X, 21);
    pdf.text(data.schoolName, PAGE_W - MARGIN_X, 12, { align: 'right' });
    pdf.setTextColor(204, 251, 241);
    pdf.text(`Período: ${data.periodoLabel}`, PAGE_W - MARGIN_X, 19, { align: 'right' });
    y = 42;
  };

  const addPage = (title: string, subtitle?: string) => {
    if (pdf.getNumberOfPages() > 0 && y > 0) pdf.addPage();
    addBrandHeader(title, subtitle);
  };

  const sectionTitle = (title: string, note?: string) => {
    pdf.setFillColor(...ACCENT);
    pdf.rect(MARGIN_X, y - 3.8, 1.6, 5.5, 'F');
    pdf.setTextColor(...TEXT);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(title, MARGIN_X + 4, y);
    if (note) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...MUTED);
      pdf.text(note, PAGE_W - MARGIN_X, y, { align: 'right' });
    }
    y += 7;
  };

  const table = (opts: Parameters<typeof autoTable>[1]) => {
    const startingPage = pdf.getCurrentPageInfo().pageNumber;
    const suppliedDidDrawPage = opts.didDrawPage;
    autoTable(pdf, {
      startY: y,
      theme: 'grid',
      headStyles: { fillColor: PRIMARY_DARK, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: TEXT, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: SURFACE },
      margin: { left: MARGIN_X, right: MARGIN_X, top: 38, bottom: 17 },
      ...opts,
      didDrawPage: hookData => {
        if (pdf.getCurrentPageInfo().pageNumber > startingPage) {
          pdf.setFillColor(...PRIMARY_DARK);
          pdf.rect(0, 0, PAGE_W, 31, 'F');
          pdf.setFillColor(...ACCENT);
          pdf.rect(0, 31, PAGE_W, 1.4, 'F');
          if (logo) {
            try { pdf.addImage(logo, 'PNG', MARGIN_X, 7, 34, 16); } catch { /* optional */ }
          }
          pdf.setTextColor(...WHITE);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(12);
          pdf.text('ANEXO · CONTINUAÇÃO', logo ? 55 : MARGIN_X, 14);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.text(data.schoolName, PAGE_W - MARGIN_X, 12, { align: 'right' });
          pdf.setTextColor(204, 251, 241);
          pdf.text(data.periodoLabel, PAGE_W - MARGIN_X, 19, { align: 'right' });
        }
        suppliedDidDrawPage?.(hookData);
      },
    });
    y = (pdf as any).lastAutoTable.finalY + 7;
  };

  const drawBars = (items: { label: string; value: number; color?: [number, number, number] }[], x: number, width: number, startY: number, maxRows = 7) => {
    const rows = items.slice(0, maxRows);
    const max = Math.max(...rows.map(i => i.value), 1);
    rows.forEach((item, index) => {
      const yy = startY + index * 11;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...TEXT);
      pdf.text(item.label.slice(0, 34), x, yy);
      pdf.setFont('helvetica', 'bold');
      pdf.text(fmtBRL(item.value), x + width, yy, { align: 'right' });
      pdf.setFillColor(...BORDER);
      pdf.roundedRect(x, yy + 2, width, 2.5, 1, 1, 'F');
      pdf.setFillColor(...(item.color || PRIMARY));
      pdf.roundedRect(x, yy + 2, Math.max(1, width * item.value / max), 2.5, 1, 1, 'F');
    });
  };

  const drawLineChart = (series: { label: string; values: number[]; color: [number, number, number] }[], labels: string[], x: number, top: number, width: number, height: number) => {
    const values = series.flatMap(s => s.values);
    const min = Math.min(0, ...values);
    const max = Math.max(1, ...values);
    const span = max - min || 1;
    pdf.setDrawColor(...BORDER);
    pdf.setLineWidth(0.2);
    for (let i = 0; i <= 4; i++) {
      const gy = top + (height * i / 4);
      pdf.line(x, gy, x + width, gy);
    }
    labels.forEach((label, i) => {
      const px = labels.length === 1 ? x + width / 2 : x + i * width / (labels.length - 1);
      pdf.setFontSize(6.5);
      pdf.setTextColor(...MUTED);
      pdf.text(label, px, top + height + 5, { align: 'center' });
    });
    series.forEach(s => {
      pdf.setDrawColor(...s.color);
      pdf.setFillColor(...s.color);
      pdf.setLineWidth(0.8);
      s.values.forEach((value, i) => {
        const px = s.values.length === 1 ? x + width / 2 : x + i * width / (s.values.length - 1);
        const py = top + height - ((value - min) / span) * height;
        if (i > 0) {
          const prevX = x + (i - 1) * width / (s.values.length - 1);
          const prevY = top + height - ((s.values[i - 1] - min) / span) * height;
          pdf.line(prevX, prevY, px, py);
        }
        pdf.circle(px, py, 1.2, 'F');
      });
    });
  };

  // Página 1 — Resumo executivo
  addBrandHeader('RELATÓRIO FINANCEIRO CONSOLIDADO', 'Resumo executivo para tomada de decisão');
  const cards = [
    ['Saldo inicial', data.saldoInicial, PRIMARY_DARK], ['Receitas', data.receitas, SUCCESS],
    ['Despesas', data.despesas, DANGER], ['Resultado', data.resultado, data.resultado >= 0 ? SUCCESS : DANGER],
    ['Saldo final', data.saldoFinal, data.saldoFinal >= 0 ? PRIMARY_DARK : DANGER],
  ] as [string, number, [number, number, number]][];
  const cardW = 34.8;
  cards.forEach((card, i) => {
    const x = MARGIN_X + i * (cardW + 2.7);
    pdf.setDrawColor(...BORDER);
    pdf.setFillColor(...SURFACE);
    pdf.roundedRect(x, y, cardW, 22, 1.2, 1.2, 'FD');
    pdf.setFillColor(...card[2]);
    pdf.rect(x, y, 1.5, 22, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5); pdf.setTextColor(...MUTED);
    pdf.text(card[0].toUpperCase(), x + 4, y + 7);
    pdf.setTextColor(...card[2]); pdf.setFontSize(8.5);
    let value = fmtBRL(card[1]);
    while (pdf.getTextWidth(value) > cardW - 7 && pdf.getFontSize() > 6) pdf.setFontSize(pdf.getFontSize() - .5);
    pdf.text(value, x + 4, y + 15);
  });
  y += 32;
  sectionTitle('Evolução do período', `${data.sources.join(' + ') || 'Sem fonte identificada'}`);
  if (data.monthly.length) {
    drawLineChart([
      { label: 'Receitas', values: data.monthly.map(m => m.receitas), color: SUCCESS },
      { label: 'Despesas', values: data.monthly.map(m => m.despesas), color: DANGER },
      { label: 'Resultado', values: data.monthly.map(m => m.resultado), color: ACCENT },
    ], data.monthly.map(m => m.label), MARGIN_X + 4, y + 4, 176, 58);
    y += 73;
  } else {
    pdf.setTextColor(...MUTED); pdf.setFontSize(9); pdf.text('Sem dados cadastrados no período.', MARGIN_X, y + 8); y += 20;
  }
  sectionTitle('Leitura gerencial');
  const margin = data.receitas ? (data.resultado / data.receitas) * 100 : 0;
  const expenseWeight = data.receitas ? (data.despesas / data.receitas) * 100 : 0;
  const insights = [
    `Margem do resultado: ${fmtNumber(margin, 1)}%`,
    `Despesas representam ${fmtNumber(expenseWeight, 1)}% das receitas`,
    `Variação do caixa no período: ${fmtBRL(data.saldoFinal - data.saldoInicial)}`,
  ];
  insights.forEach((txt, i) => {
    const x = MARGIN_X + i * 60.5;
    pdf.setFillColor(i === 1 && expenseWeight > 100 ? 255 : 240, i === 1 && expenseWeight > 100 ? 247 : 253, i === 1 && expenseWeight > 100 ? 237 : 250);
    pdf.setDrawColor(...(i === 1 && expenseWeight > 100 ? ACCENT : BORDER));
    pdf.roundedRect(x, y, 57, 20, 1.2, 1.2, 'FD');
    pdf.setTextColor(...TEXT); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5);
    pdf.text(pdf.splitTextToSize(txt, 50), x + 4, y + 7);
  });

  // Página 2 — evolução financeira
  addPage('EVOLUÇÃO FINANCEIRA E SALDO');
  sectionTitle('Resumo financeiro mês a mês');
  if (data.monthly.length) {
    table({
      head: [['Mês', 'Fonte', 'Saldo inicial', 'Receitas', 'Despesas', 'Resultado', 'Saldo final']],
      body: data.monthly.map(m => [m.label, m.source, fmtBRL(m.saldoInicial), fmtBRL(m.receitas), fmtBRL(m.despesas), fmtBRL(m.resultado), fmtBRL(m.saldoFinal)]),
      styles: { fontSize: 6.5 },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
    });
    sectionTitle('Evolução do saldo', 'Fechamento de cada mês');
    drawLineChart([{ label: 'Saldo final', values: data.monthly.map(m => m.saldoFinal), color: PRIMARY_DARK }], data.monthly.map(m => m.label), MARGIN_X + 4, y + 3, 176, 62);
  } else {
    pdf.setTextColor(...MUTED); pdf.text('Sem dados cadastrados no período.', MARGIN_X, y + 8);
  }

  // Página 3 — despesas
  addPage('ANÁLISE DE DESPESAS', 'Categorias-mãe e subcategorias');
  const motherMap = new Map<string, number>();
  data.expenses.forEach(e => motherMap.set(e.mae, (motherMap.get(e.mae) || 0) + e.valor));
  const mothers = Array.from(motherMap.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  sectionTitle('Despesas por categoria-mãe', `Total detalhado: ${fmtBRL(data.expenseDetailTotal)}`);
  if (mothers.length) {
    drawBars(mothers.map((m, i) => ({ ...m, color: i === 0 ? ACCENT : PRIMARY })), MARGIN_X, 180, y + 3, 9);
    y += Math.min(mothers.length, 9) * 11 + 9;
  } else {
    pdf.setTextColor(...MUTED); pdf.setFontSize(9); pdf.text('Sem dados cadastrados no período.', MARGIN_X, y + 8); y += 18;
  }
  sectionTitle('Detalhamento por subcategoria');
  if (data.expenses.length) {
    table({
      head: [['Categoria-mãe', 'Subcategoria', 'Valor', '% detalhado']],
      body: data.expenses.map(e => [e.mae, e.filha, fmtBRL(e.valor), data.expenseDetailTotal ? `${fmtNumber(e.valor / data.expenseDetailTotal * 100, 1)}%` : '—']),
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right', cellWidth: 24 } },
    });
  } else pdf.text('Sem dados cadastrados no período.', MARGIN_X, y + 8);

  // Página 4 — indicadores
  addPage('INDICADORES DE GESTÃO', 'Último valor do período e tendência');
  if (data.kpis.length) {
    const tileW = 87.5;
    data.kpis.slice(0, 8).forEach((k, i) => {
      const col = i % 2; const row = Math.floor(i / 2); const x = MARGIN_X + col * 92.5; const yy = 44 + row * 34;
      pdf.setFillColor(...SURFACE); pdf.setDrawColor(...BORDER); pdf.roundedRect(x, yy, tileW, 28, 1.2, 1.2, 'FD');
      pdf.setFillColor(...(k.status ? ACCENT : PRIMARY)); pdf.rect(x, yy, 1.5, 28, 'F');
      pdf.setTextColor(...MUTED); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.text(k.name.toUpperCase(), x + 5, yy + 7);
      pdf.setTextColor(...TEXT); pdf.setFontSize(14); pdf.text(formatKpi(k.value, k.valueType, k.decimals), x + 5, yy + 17);
      pdf.setFontSize(6.5); pdf.setTextColor(...MUTED);
      const extra = [k.status, k.variation == null ? '' : `${k.variation >= 0 ? '+' : ''}${fmtNumber(k.variation, 1)}% vs anterior`].filter(Boolean).join(' · ');
      pdf.text(extra || 'Sem comparação disponível', x + 5, yy + 23);
    });
    y = 44 + Math.ceil(Math.min(data.kpis.length, 8) / 2) * 34 + 4;
    sectionTitle('Tabela completa de indicadores');
    table({
      head: [['Indicador', 'Valor', 'Classificação', 'Variação']],
      body: data.kpis.map(k => [k.name, formatKpi(k.value, k.valueType, k.decimals), k.status || '—', k.variation == null ? '—' : `${k.variation >= 0 ? '+' : ''}${fmtNumber(k.variation, 1)}%`]),
      columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } },
    });
  } else {
    pdf.setTextColor(...MUTED); pdf.setFontSize(9); pdf.text('Sem dados cadastrados no período.', MARGIN_X, y + 8);
  }

  // Página 5 — conversão e matrículas
  addPage('CONVERSÃO E MATRÍCULAS', 'Captação, conversão e comparação ano contra ano');
  const contatos = data.conversion.reduce((s, c) => s + c.contatos, 0);
  const matriculas = data.conversion.reduce((s, c) => s + c.matriculas, 0);
  const taxa = contatos ? matriculas / contatos * 100 : 0;
  const convCards = [['Contatos', fmtNumber(contatos)], ['Matrículas', fmtNumber(matriculas)], ['Conversão', `${fmtNumber(taxa, 1)}%`]];
  convCards.forEach((c, i) => {
    const x = MARGIN_X + i * 61.5;
    pdf.setDrawColor(...BORDER); pdf.setFillColor(...SURFACE); pdf.roundedRect(x, y, 57.5, 20, 1.2, 1.2, 'FD');
    pdf.setFillColor(...(i === 1 ? ACCENT : PRIMARY)); pdf.rect(x, y, 1.5, 20, 'F');
    pdf.setTextColor(...MUTED); pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.text(c[0].toUpperCase(), x + 5, y + 7);
    pdf.setTextColor(...TEXT); pdf.setFontSize(13); pdf.text(c[1], x + 5, y + 15);
  });
  y += 30;
  sectionTitle('Evolução da conversão');
  if (data.conversion.length) {
    drawLineChart([
      { label: 'Contatos', values: data.conversion.map(c => c.contatos), color: PRIMARY_DARK },
      { label: 'Matrículas', values: data.conversion.map(c => c.matriculas), color: ACCENT },
    ], data.conversion.map(c => c.label), MARGIN_X + 4, y + 2, 176, 50);
    y += 65;
  } else { pdf.setTextColor(...MUTED); pdf.text('Sem dados cadastrados no período.', MARGIN_X, y + 8); y += 18; }
  sectionTitle(`Matrículas: ${data.currentYear} x ${data.previousYear}`, 'Meses equivalentes');
  if (data.enrollmentsYoY.length) {
    drawLineChart([
      { label: data.currentYear, values: data.enrollmentsYoY.map(m => m.current), color: PRIMARY_DARK },
      { label: data.previousYear, values: data.enrollmentsYoY.map(m => m.previous), color: ACCENT },
    ], data.enrollmentsYoY.map(m => m.label), MARGIN_X + 4, y + 2, 176, 50);
    y += 63;
    const currentTotal = data.enrollmentsYoY.reduce((s, m) => s + m.current, 0);
    const previousTotal = data.enrollmentsYoY.reduce((s, m) => s + m.previous, 0);
    const yoy = previousTotal ? (currentTotal - previousTotal) / previousTotal * 100 : null;
    pdf.setTextColor(...TEXT); pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
    pdf.text(`${data.currentYear}: ${fmtNumber(currentTotal)} matrículas`, MARGIN_X, y);
    pdf.text(`${data.previousYear}: ${fmtNumber(previousTotal)} matrículas`, 78, y);
    pdf.setTextColor(...(yoy != null && yoy >= 0 ? SUCCESS : DANGER));
    pdf.text(`Variação: ${yoy == null ? '—' : `${yoy >= 0 ? '+' : ''}${fmtNumber(yoy, 1)}%`}`, PAGE_W - MARGIN_X, y, { align: 'right' });
  } else pdf.text('Sem dados cadastrados para a comparação anual.', MARGIN_X, y + 8);

  // Página 6 — anexo de conversão
  addPage('ANEXOS GERENCIAIS', 'Tabelas de conferência do período');
  sectionTitle('Conversão por mês e origem');
  if (data.conversion.length) {
    table({
      head: [['Mês', 'Origem', 'Contatos', 'Matrículas', 'Conversão']],
      body: data.conversion.map(c => [c.label, c.tipo, fmtNumber(c.contatos), fmtNumber(c.matriculas), `${fmtNumber(c.taxa, 1)}%`]),
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    });
  } else { pdf.setTextColor(...MUTED); pdf.text('Sem dados cadastrados no período.', MARGIN_X, y + 8); y += 18; }
  sectionTitle('Recebíveis por forma de cobrança');
  if (data.recebiveis.length) {
    const total = data.recebiveis.reduce((s, r) => s + r.valor, 0);
    table({ head: [['Forma', 'Valor', '%']], body: data.recebiveis.map(r => [r.label, fmtBRL(r.valor), total ? `${fmtNumber(r.valor / total * 100, 1)}%` : '—']), columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } });
  } else { pdf.setTextColor(...MUTED); pdf.text('Sem dados cadastrados no período.', MARGIN_X, y + 8); }

  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    pdf.setPage(page);
    pdf.setDrawColor(...BORDER); pdf.setLineWidth(.2); pdf.line(MARGIN_X, PAGE_H - 12, PAGE_W - MARGIN_X, PAGE_H - 12);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(...MUTED);
    pdf.text(`${data.schoolName} · ${data.periodoLabel} · Gerado em ${generatedAt}`, MARGIN_X, PAGE_H - 7);
    pdf.text(`Página ${page} de ${totalPages}`, PAGE_W - MARGIN_X, PAGE_H - 7, { align: 'right' });
  }
  pdf.save(`${data.fileName || 'relatorio-financeiro-consolidado'}.pdf`);
}
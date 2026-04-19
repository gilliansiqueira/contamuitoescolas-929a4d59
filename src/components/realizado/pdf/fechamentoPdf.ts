import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import contaMuitoLogo from '@/assets/logo-conta-muito.png';

const fmtBRL = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtNumber = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

const fmtVariation = (curr: number, prev: number) => {
  if (prev === 0 && curr === 0) return { abs: '—', pct: '—', dir: '=' as const };
  if (prev === 0) return { abs: fmtBRL(curr), pct: '—', dir: curr >= 0 ? ('▲' as const) : ('▼' as const) };
  const diff = curr - prev;
  const pct = (diff / Math.abs(prev)) * 100;
  return {
    abs: (diff >= 0 ? '+' : '') + fmtBRL(diff),
    pct: (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%',
    dir: (diff > 0 ? '▲' : diff < 0 ? '▼' : '=') as '▲' | '▼' | '=',
  };
};

// Brand colors (RGB)
const PRIMARY: [number, number, number] = [14, 165, 164]; // teal
const ACCENT: [number, number, number] = [245, 158, 11]; // orange
const TEXT: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const BORDER: [number, number, number] = [226, 232, 240];
const SUCCESS: [number, number, number] = [16, 185, 129];
const DANGER: [number, number, number] = [239, 68, 68];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 15;

interface GenerateOpts {
  schoolId: string;
  selectedMonth: string; // MM
  selectedYear: string;  // YYYY
}

function previousMonth(year: string, month: string): string {
  const m = parseInt(month);
  const y = parseInt(year);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

export async function generateFechamentoPdf({ schoolId, selectedMonth, selectedYear }: GenerateOpts) {
  const monthStr = `${selectedYear}-${selectedMonth}`;
  const prevMonthStr = previousMonth(selectedYear, selectedMonth);

  // ============ Fetch all data in parallel ============
  const [
    schoolRes,
    tabsRes,
    expensesRes,
    revenueRes,
    salesRes,
    salesMethodsRes,
    cardBrandsRes,
    kpiDefsRes,
    kpiValuesRes,
    kpiThresholdsRes,
    convDataRes,
    accountsRes,
  ] = await Promise.all([
    supabase.from('schools').select('nome,saldo_inicial').eq('id', schoolId).single(),
    supabase.from('module_tabs').select('*').eq('school_id', schoolId),
    supabase.from('realized_entries').select('*').eq('school_id', schoolId),
    supabase.from('monthly_revenue').select('*').eq('school_id', schoolId),
    supabase.from('sales_data').select('*').eq('school_id', schoolId),
    supabase.from('sales_payment_methods').select('*').eq('school_id', schoolId).eq('enabled', true),
    supabase.from('sales_card_brands').select('*'),
    supabase.from('kpi_definitions').select('*').eq('school_id', schoolId).eq('enabled', true),
    supabase.from('kpi_values').select('*').eq('school_id', schoolId),
    supabase.from('kpi_thresholds').select('*'),
    supabase.from('conversion_data').select('*').eq('school_id', schoolId),
    supabase.from('chart_of_accounts').select('*').eq('school_id', schoolId),
  ]);

  const school = schoolRes.data;
  const tabs = tabsRes.data || [];
  const expenses = expensesRes.data || [];
  const revenue = revenueRes.data || [];
  const sales = salesRes.data || [];
  const salesMethods = salesMethodsRes.data || [];
  const cardBrands = cardBrandsRes.data || [];
  const kpiDefs = kpiDefsRes.data || [];
  const kpiValues = kpiValuesRes.data || [];
  const kpiThresholds = kpiThresholdsRes.data || [];
  const convData = convDataRes.data || [];
  const accounts = accountsRes.data || [];

  const visibility = { relatorio: true, indicadores: true, conversao: true, vendas: true };
  tabs.forEach((t: any) => {
    if (t.tab_key in visibility) (visibility as any)[t.tab_key] = t.enabled;
  });

  // ============ Derived data ============
  const monthExpensesAll = expenses.filter((e: any) => e.data?.startsWith(monthStr));
  const prevMonthExpensesAll = expenses.filter((e: any) => e.data?.startsWith(prevMonthStr));
  // Real expenses (only "despesa" tipo)
  const monthExpenses = monthExpensesAll.filter((e: any) => (e.tipo || 'despesa') === 'despesa');
  const prevMonthExpenses = prevMonthExpensesAll.filter((e: any) => (e.tipo || 'despesa') === 'despesa');
  // Realized revenues (entries marked as receita)
  const monthRevEntries = monthExpensesAll.filter((e: any) => e.tipo === 'receita');
  const prevMonthRevEntries = prevMonthExpensesAll.filter((e: any) => e.tipo === 'receita');

  const totalExpenses = monthExpenses.reduce((a: number, b: any) => a + Number(b.valor), 0);
  const totalExpensesPrev = prevMonthExpenses.reduce((a: number, b: any) => a + Number(b.valor), 0);

  const monthRevenueManual = revenue.find((x: any) => x.month === monthStr);
  const prevRevenueManual = revenue.find((x: any) => x.month === prevMonthStr);
  const totalRevenue =
    (monthRevenueManual ? Number(monthRevenueManual.value) : 0) ||
    monthRevEntries.reduce((a: number, b: any) => a + Number(b.valor), 0);
  const totalRevenuePrev =
    (prevRevenueManual ? Number(prevRevenueManual.value) : 0) ||
    prevMonthRevEntries.reduce((a: number, b: any) => a + Number(b.valor), 0);

  const monthSales = sales.filter((s: any) => s.month === monthStr);
  const prevMonthSales = sales.filter((s: any) => s.month === prevMonthStr);
  const totalSales = monthSales.reduce((a: number, b: any) => a + Number(b.value), 0);
  const totalSalesPrev = prevMonthSales.reduce((a: number, b: any) => a + Number(b.value), 0);

  // Expenses by category (mãe / filha)
  const accMap = new Map<string, any>(accounts.map((a: any) => [a.id, a]));
  const expDetailMap = new Map<string, { mae: string; filha: string; valor: number }>();
  monthExpenses.forEach((e: any) => {
    const acc = e.conta_id ? accMap.get(e.conta_id) : null;
    let mae = '—';
    let filha = e.conta_nome || e.descricao || '—';
    if (acc) {
      if (acc.pai_id) {
        const parent = accMap.get(acc.pai_id);
        mae = parent?.nome || '—';
        filha = acc.nome;
      } else {
        mae = acc.nome;
        filha = '(sem subcategoria)';
      }
    }
    const key = `${mae}||${filha}`;
    const cur = expDetailMap.get(key) || { mae, filha, valor: 0 };
    cur.valor += Number(e.valor);
    expDetailMap.set(key, cur);
  });
  const expensesDetail = Array.from(expDetailMap.values()).sort((a, b) => b.valor - a.valor);

  // Sales by method
  const salesByMethodMap: Record<string, number> = {};
  salesMethods.forEach((sm: any) => (salesByMethodMap[sm.method_key] = 0));
  monthSales.forEach((s: any) => {
    let base = s.method_key;
    if (s.method_key.startsWith('brand-')) base = s.method_key.includes('debito') ? 'debito' : 'credito';
    salesByMethodMap[base] = (salesByMethodMap[base] || 0) + Number(s.value);
  });
  const salesByMethod = Object.entries(salesByMethodMap)
    .map(([key, val]) => {
      const label = salesMethods.find((m: any) => m.method_key === key)?.label || key;
      return { name: label, value: val, key };
    })
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);

  const salesByMethodPrevMap: Record<string, number> = {};
  prevMonthSales.forEach((s: any) => {
    let base = s.method_key;
    if (s.method_key.startsWith('brand-')) base = s.method_key.includes('debito') ? 'debito' : 'credito';
    salesByMethodPrevMap[base] = (salesByMethodPrevMap[base] || 0) + Number(s.value);
  });

  // Brands
  const brandsTotal: Record<string, number> = {};
  monthSales.forEach((s: any) => {
    if (s.method_key.startsWith('brand-')) {
      brandsTotal[s.brand_id || ''] = (brandsTotal[s.brand_id || ''] || 0) + Number(s.value);
    }
  });
  const salesByBrand = Object.entries(brandsTotal)
    .map(([brandId, val]) => {
      const b = cardBrands.find((cb: any) => cb.id === brandId);
      return { name: b?.name || 'Bandeira', value: val };
    })
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);

  // Conversion
  const monthConv = convData.find((c: any) => c.month === monthStr);
  const prevConv = convData.find((c: any) => c.month === prevMonthStr);

  // ============ Build PDF ============
  const pdf = new jsPDF('p', 'mm', 'a4');

  // Pre-load logo as data URL
  let logoDataUrl: string | null = null;
  try {
    logoDataUrl = await fetch(contaMuitoLogo)
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          })
      );
  } catch {
    logoDataUrl = null;
  }

  let y = MARGIN_X;

  const addHeader = () => {
    // Logo
    if (logoDataUrl) {
      try {
        pdf.addImage(logoDataUrl, 'PNG', PAGE_W - MARGIN_X - 25, MARGIN_X, 25, 12);
      } catch {}
    }
    // Accent bar
    pdf.setFillColor(...PRIMARY);
    pdf.rect(MARGIN_X, MARGIN_X, 3, 18, 'F');
    // Title
    pdf.setTextColor(...ACCENT);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text('FECHAMENTO FINANCEIRO', MARGIN_X + 6, MARGIN_X + 4);
    pdf.setTextColor(...TEXT);
    pdf.setFontSize(16);
    pdf.text(school?.nome || 'Escola', MARGIN_X + 6, MARGIN_X + 11);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...MUTED);
    const periodo = format(new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1), "MMMM 'de' yyyy", {
      locale: ptBR,
    });
    pdf.text(`Período: ${periodo}`, MARGIN_X + 6, MARGIN_X + 16);
    pdf.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, PAGE_W - MARGIN_X, MARGIN_X + 18, {
      align: 'right',
    });
    // Divider
    pdf.setDrawColor(...PRIMARY);
    pdf.setLineWidth(0.5);
    pdf.line(MARGIN_X, MARGIN_X + 22, PAGE_W - MARGIN_X, MARGIN_X + 22);
    y = MARGIN_X + 28;
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(15);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(...TEXT);
    pdf.text(title, MARGIN_X, y);
    pdf.setDrawColor(...PRIMARY);
    pdf.setLineWidth(0.8);
    pdf.line(MARGIN_X, y + 1.5, MARGIN_X + 40, y + 1.5);
    y += 8;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - 18) {
      addFooter();
      pdf.addPage();
      addHeader();
    }
  };

  let pageNum = 1;
  const addFooter = () => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.setDrawColor(...BORDER);
    pdf.line(MARGIN_X, PAGE_H - 12, PAGE_W - MARGIN_X, PAGE_H - 12);
    pdf.text(`${school?.nome || ''} · Fechamento Financeiro`, MARGIN_X, PAGE_H - 7);
    pdf.text(`Página ${pageNum}`, PAGE_W - MARGIN_X, PAGE_H - 7, { align: 'right' });
    pageNum++;
  };

  // ============ PAGE 1: Header + Resumo Projeção + Resultado Realizado ============
  addHeader();

  // ----- 3. Resumo Financeiro (Projeção) -----
  addSectionTitle('Resumo Financeiro (Projeção)');
  const saldoInicial = Number(school?.saldo_inicial || 0);
  const resultadoPeriodo = totalRevenue - totalExpenses;
  const saldoFinal = saldoInicial + resultadoPeriodo;
  autoTable(pdf, {
    startY: y,
    head: [['Item', 'Valor']],
    body: [
      ['Saldo inicial', fmtBRL(saldoInicial)],
      ['Receitas', fmtBRL(totalRevenue)],
      ['Despesas', fmtBRL(totalExpenses)],
      [
        { content: 'Resultado do período', styles: { fontStyle: 'bold' } },
        { content: fmtBRL(resultadoPeriodo), styles: { fontStyle: 'bold', textColor: resultadoPeriodo >= 0 ? SUCCESS : DANGER } },
      ],
      [
        { content: 'Saldo final', styles: { fontStyle: 'bold' } },
        { content: fmtBRL(saldoFinal), styles: { fontStyle: 'bold' } },
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 10, textColor: TEXT },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: MARGIN_X, right: MARGIN_X },
  });
  y = (pdf as any).lastAutoTable.finalY + 8;

  // ----- 4. Resultado Realizado do Mês -----
  addSectionTitle('Resultado Realizado do Mês');
  const resultadoRealizado = totalRevenue - totalExpenses;
  const resultadoRealizadoPrev = totalRevenuePrev - totalExpensesPrev;
  const varReceita = fmtVariation(totalRevenue, totalRevenuePrev);
  const varDespesa = fmtVariation(totalExpenses, totalExpensesPrev);
  const varResultado = fmtVariation(resultadoRealizado, resultadoRealizadoPrev);
  autoTable(pdf, {
    startY: y,
    head: [['Item', 'Mês atual', 'Mês anterior', 'Variação', '%']],
    body: [
      ['Total de receitas', fmtBRL(totalRevenue), fmtBRL(totalRevenuePrev), `${varReceita.dir} ${varReceita.abs}`, varReceita.pct],
      ['Total de despesas', fmtBRL(totalExpenses), fmtBRL(totalExpensesPrev), `${varDespesa.dir} ${varDespesa.abs}`, varDespesa.pct],
      [
        { content: 'Resultado do mês', styles: { fontStyle: 'bold' } },
        { content: fmtBRL(resultadoRealizado), styles: { fontStyle: 'bold', textColor: resultadoRealizado >= 0 ? SUCCESS : DANGER } },
        { content: fmtBRL(resultadoRealizadoPrev), styles: { fontStyle: 'bold' } },
        { content: `${varResultado.dir} ${varResultado.abs}`, styles: { fontStyle: 'bold' } },
        { content: varResultado.pct, styles: { fontStyle: 'bold' } },
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 9, textColor: TEXT },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    margin: { left: MARGIN_X, right: MARGIN_X },
  });
  y = (pdf as any).lastAutoTable.finalY + 8;

  // ----- 5. Despesas Detalhadas -----
  addSectionTitle('Despesas Detalhadas');
  if (expensesDetail.length === 0) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(10);
    pdf.setTextColor(...MUTED);
    pdf.text('Sem despesas registradas no período.', MARGIN_X, y);
    y += 8;
  } else {
    autoTable(pdf, {
      startY: y,
      head: [['Categoria mãe', 'Categoria filha', 'Valor', '%']],
      body: expensesDetail.map((d) => [
        d.mae,
        d.filha,
        fmtBRL(d.valor),
        totalExpenses > 0 ? `${((d.valor / totalExpenses) * 100).toFixed(1)}%` : '—',
      ]),
      foot: [[
        { content: 'TOTAL', styles: { fontStyle: 'bold' } },
        '',
        { content: fmtBRL(totalExpenses), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: '100%', styles: { fontStyle: 'bold', halign: 'right' } },
      ]],
      theme: 'striped',
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      footStyles: { fillColor: [240, 253, 250], textColor: TEXT },
      bodyStyles: { fontSize: 9, textColor: TEXT },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
      margin: { left: MARGIN_X, right: MARGIN_X },
      didDrawPage: () => { /* keep header on continuation pages handled below */ },
    });
    y = (pdf as any).lastAutoTable.finalY + 8;
  }

  // ----- 6. Indicadores -----
  if (visibility.indicadores) {
    ensureSpace(30);
    addSectionTitle('Indicadores');
    const enabledKpis = kpiDefs.filter((d: any) => kpiValues.some((v: any) => v.kpi_definition_id === d.id));
    if (enabledKpis.length === 0) {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(10);
      pdf.setTextColor(...MUTED);
      pdf.text('Sem indicadores ativos.', MARGIN_X, y);
      y += 8;
    } else {
      const kpiRows = enabledKpis.map((def: any) => {
        const kvCurr = kpiValues.find((v: any) => v.kpi_definition_id === def.id && v.month === monthStr);
        const kvPrev = kpiValues.find((v: any) => v.kpi_definition_id === def.id && v.month === prevMonthStr);
        const valCurr = kvCurr ? Number(kvCurr.value) : null;
        const valPrev = kvPrev ? Number(kvPrev.value) : null;
        const fmtVal = (v: number | null) => {
          if (v === null) return '—';
          if (def.value_type === 'currency') return fmtBRL(v);
          if (def.value_type === 'percent') return `${v.toLocaleString('pt-BR')}%`;
          return v.toLocaleString('pt-BR');
        };
        let variation = '—';
        if (valCurr !== null && valPrev !== null && valPrev !== 0) {
          const pct = ((valCurr - valPrev) / Math.abs(valPrev)) * 100;
          variation = `${pct >= 0 ? '▲ +' : '▼ '}${pct.toFixed(1)}%`;
        }
        // Threshold label
        let classLabel = '—';
        if (valCurr !== null) {
          const thresholds = kpiThresholds.filter((t: any) => t.kpi_definition_id === def.id);
          const match = thresholds.find((t: any) => {
            const okMin = t.min_value === null || valCurr >= Number(t.min_value);
            const okMax = t.max_value === null || valCurr <= Number(t.max_value);
            return okMin && okMax;
          });
          if (match) classLabel = match.label;
        }
        return [def.name, fmtVal(valCurr), fmtVal(valPrev), variation, classLabel];
      });
      autoTable(pdf, {
        startY: y,
        head: [['Indicador', 'Atual', 'Mês anterior', 'Variação', 'Classificação']],
        body: kpiRows,
        theme: 'grid',
        headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
        bodyStyles: { fontSize: 9, textColor: TEXT },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
        margin: { left: MARGIN_X, right: MARGIN_X },
      });
      y = (pdf as any).lastAutoTable.finalY + 8;
    }
  }

  // ----- 7. Conversão -----
  if (visibility.conversao) {
    ensureSpace(30);
    addSectionTitle('Conversão');
    const contatos = monthConv?.contatos ?? 0;
    const matriculas = monthConv?.matriculas ?? 0;
    const taxa = contatos > 0 ? (matriculas / contatos) * 100 : 0;
    const contatosPrev = prevConv?.contatos ?? 0;
    const matriculasPrev = prevConv?.matriculas ?? 0;
    const taxaPrev = contatosPrev > 0 ? (matriculasPrev / contatosPrev) * 100 : 0;
    const varTaxa = taxaPrev === 0 ? '—' : `${(taxa - taxaPrev >= 0 ? '+' : '')}${(taxa - taxaPrev).toFixed(1)} p.p.`;
    autoTable(pdf, {
      startY: y,
      head: [['Item', 'Mês atual', 'Mês anterior', 'Variação']],
      body: [
        ['Contatos', fmtNumber(contatos), fmtNumber(contatosPrev), `${contatos - contatosPrev >= 0 ? '+' : ''}${contatos - contatosPrev}`],
        ['Matrículas', fmtNumber(matriculas), fmtNumber(matriculasPrev), `${matriculas - matriculasPrev >= 0 ? '+' : ''}${matriculas - matriculasPrev}`],
        [
          { content: 'Taxa de conversão', styles: { fontStyle: 'bold' } },
          { content: `${taxa.toFixed(1)}%`, styles: { fontStyle: 'bold' } },
          { content: `${taxaPrev.toFixed(1)}%`, styles: { fontStyle: 'bold' } },
          { content: varTaxa, styles: { fontStyle: 'bold' } },
        ],
      ],
      theme: 'grid',
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9, textColor: TEXT },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      margin: { left: MARGIN_X, right: MARGIN_X },
    });
    y = (pdf as any).lastAutoTable.finalY + 8;
  }

  // ----- 8. Vendas -----
  if (visibility.vendas) {
    ensureSpace(40);
    addSectionTitle('Vendas');
    const varTotal = fmtVariation(totalSales, totalSalesPrev);
    autoTable(pdf, {
      startY: y,
      head: [['Item', 'Mês atual', 'Mês anterior', 'Variação', '%']],
      body: [
        [
          { content: 'TOTAL GERAL', styles: { fontStyle: 'bold' } },
          { content: fmtBRL(totalSales), styles: { fontStyle: 'bold' } },
          { content: fmtBRL(totalSalesPrev), styles: { fontStyle: 'bold' } },
          { content: `${varTotal.dir} ${varTotal.abs}`, styles: { fontStyle: 'bold' } },
          { content: varTotal.pct, styles: { fontStyle: 'bold' } },
        ],
      ],
      theme: 'grid',
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9, textColor: TEXT },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      margin: { left: MARGIN_X, right: MARGIN_X },
    });
    y = (pdf as any).lastAutoTable.finalY + 6;

    // Por forma de pagamento
    if (salesByMethod.length > 0) {
      ensureSpace(20);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(...TEXT);
      pdf.text('Por forma de pagamento', MARGIN_X, y);
      y += 4;
      autoTable(pdf, {
        startY: y,
        head: [['Forma de pagamento', 'Mês atual', 'Mês anterior', '%']],
        body: salesByMethod.map((m) => [
          m.name,
          fmtBRL(m.value),
          fmtBRL(salesByMethodPrevMap[m.key] || 0),
          totalSales > 0 ? `${((m.value / totalSales) * 100).toFixed(1)}%` : '—',
        ]),
        theme: 'striped',
        headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: TEXT },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
        margin: { left: MARGIN_X, right: MARGIN_X },
      });
      y = (pdf as any).lastAutoTable.finalY + 6;
    }

    // Detalhamento cartão de crédito por bandeira
    if (salesByBrand.length > 0) {
      ensureSpace(20);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(...TEXT);
      pdf.text('Detalhamento de cartão por bandeira', MARGIN_X, y);
      y += 4;
      const totalBrands = salesByBrand.reduce((a, b) => a + b.value, 0);
      autoTable(pdf, {
        startY: y,
        head: [['Bandeira', 'Valor', '%']],
        body: salesByBrand.map((b) => [
          b.name,
          fmtBRL(b.value),
          totalBrands > 0 ? `${((b.value / totalBrands) * 100).toFixed(1)}%` : '—',
        ]),
        theme: 'striped',
        headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: TEXT },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        margin: { left: MARGIN_X, right: MARGIN_X },
      });
      y = (pdf as any).lastAutoTable.finalY + 6;
    }
  }

  addFooter();

  // ============ Save ============
  const monthLabel = format(new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1), 'MMMM', { locale: ptBR });
  const safeSchool = (school?.nome || 'Escola').replace(/[^a-z0-9]/gi, '_');
  const fileName = `Fechamento_Financeiro_${safeSchool}_${monthLabel}_${selectedYear}.pdf`;
  pdf.save(fileName);
}

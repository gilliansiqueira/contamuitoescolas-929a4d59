import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import contaMuitoLogo from '@/assets/logo-conta-muito.png';

/**
 * Gerador do PDF "Mês completo" da Projeção (Dashboard).
 * PDF nativo (texto + jspdf-autotable), sem html2canvas.
 * Mantém a mesma identidade visual do gerador de Fechamento.
 */

const fmtBRL = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PRIMARY: [number, number, number] = [14, 165, 164];
const ACCENT: [number, number, number] = [245, 158, 11];
const TEXT: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const BORDER: [number, number, number] = [226, 232, 240];
const SUCCESS: [number, number, number] = [16, 185, 129];
const DANGER: [number, number, number] = [239, 68, 68];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 15;

export interface MesCompletoRow {
  label: string;
  valor: number;
  /** rótulo secundário opcional (ex.: favorecido) */
  sub?: string;
}

export interface MesCompletoData {
  schoolName: string;
  /** Rótulo do período já formatado (ex.: "Agosto de 2026" ou "3 meses selecionados") */
  periodoLabel: string;
  saldoInicial: number;
  saldoFinal: number;
  receitas: number;
  despesas: number;
  resultado: number;
  /** Receitas e despesas por tipo/categoria */
  porTipo: { label: string; valor: number; classificacao: string }[];
  /** Recebíveis por forma de cobrança */
  recebiveis: MesCompletoRow[];
  /** Contas a pagar por categoria/favorecido */
  contasPagar: MesCompletoRow[];
  /** Mês anterior (opcional) para comparação */
  anterior?: {
    label: string;
    receitas: number;
    despesas: number;
    resultado: number;
    saldoFinal: number;
  };
  fileName?: string;
}

function variation(curr: number, prev: number) {
  const diff = curr - prev;
  const pct = prev === 0 ? null : (diff / Math.abs(prev)) * 100;
  return {
    abs: (diff >= 0 ? '+' : '') + fmtBRL(diff),
    pct: pct === null ? '—' : (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%',
    positive: diff >= 0,
  };
}

async function loadLogo(): Promise<string | null> {
  try {
    const blob = await fetch(contaMuitoLogo).then((r) => r.blob());
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateMesCompletoPdf(data: MesCompletoData) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const logoDataUrl = await loadLogo();
  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  let y = MARGIN_X;
  const headeredPages = new Set<number>();

  const currentPage = () => (pdf as any).internal.getCurrentPageInfo().pageNumber as number;

  const addHeader = () => {
    const page = currentPage();
    if (headeredPages.has(page)) return;
    headeredPages.add(page);
    if (logoDataUrl) {
      try {
        pdf.addImage(logoDataUrl, 'PNG', PAGE_W - MARGIN_X - 25, MARGIN_X, 25, 12);
      } catch {
        /* logo opcional */
      }
    }
    pdf.setFillColor(...PRIMARY);
    pdf.rect(MARGIN_X, MARGIN_X, 3, 18, 'F');
    pdf.setTextColor(...ACCENT);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text('PROJEÇÃO — MÊS COMPLETO', MARGIN_X + 6, MARGIN_X + 4);
    pdf.setTextColor(...TEXT);
    pdf.setFontSize(16);
    pdf.text(data.schoolName || 'Empresa', MARGIN_X + 6, MARGIN_X + 11);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...MUTED);
    pdf.text(`Período: ${data.periodoLabel}`, MARGIN_X + 6, MARGIN_X + 16);
    pdf.setDrawColor(...PRIMARY);
    pdf.setLineWidth(0.5);
    pdf.line(MARGIN_X, MARGIN_X + 22, PAGE_W - MARGIN_X, MARGIN_X + 22);
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - 18) {
      pdf.addPage();
      addHeader();
      y = MARGIN_X + 28;
    }
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(22);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(...TEXT);
    pdf.text(title, MARGIN_X, y);
    pdf.setDrawColor(...PRIMARY);
    pdf.setLineWidth(0.8);
    pdf.line(MARGIN_X, y + 1.5, MARGIN_X + 40, y + 1.5);
    y += 7;
  };

  const table = (opts: Parameters<typeof autoTable>[1]) => {
    autoTable(pdf, {
      startY: y,
      theme: 'grid',
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: TEXT, cellPadding: 1.6 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: MARGIN_X, right: MARGIN_X, top: MARGIN_X + 28, bottom: 18 },
      ...opts,
      didDrawPage: () => addHeader(),
    });
    y = (pdf as any).lastAutoTable.finalY + 7;
  };


  addHeader();

  // ───── 1. Resumo executivo (cards) ─────
  const cards: { label: string; value: number; color: [number, number, number] }[] = [
    { label: 'Saldo inicial', value: data.saldoInicial, color: TEXT },
    { label: 'Receitas', value: data.receitas, color: SUCCESS },
    { label: 'Despesas', value: data.despesas, color: DANGER },
    { label: 'Resultado', value: data.resultado, color: data.resultado >= 0 ? SUCCESS : DANGER },
    { label: 'Saldo final', value: data.saldoFinal, color: data.saldoFinal >= 0 ? PRIMARY : DANGER },
  ];
  const gap = 3;
  const cardW = (PAGE_W - MARGIN_X * 2 - gap * (cards.length - 1)) / cards.length;
  const cardH = 20;
  ensureSpace(cardH + 6);
  cards.forEach((c, i) => {
    const x = MARGIN_X + i * (cardW + gap);
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(...BORDER);
    pdf.setLineWidth(0.2);
    pdf.roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'FD');
    pdf.setFillColor(...c.color);
    pdf.rect(x, y, cardW, 1, 'F');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    pdf.text(c.label.toUpperCase(), x + 2.5, y + 7);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...c.color);
    const txt = fmtBRL(c.value);
    let size = 9;
    pdf.setFontSize(size);
    while (pdf.getTextWidth(txt) > cardW - 5 && size > 5.5) {
      size -= 0.5;
      pdf.setFontSize(size);
    }
    pdf.text(txt, x + 2.5, y + 14.5);
  });
  y += cardH + 8;

  // ───── 2. Receitas e despesas por categoria/tipo ─────
  const receitasTipo = data.porTipo
    .filter((t) => t.classificacao === 'receita' && t.valor !== 0)
    .sort((a, b) => b.valor - a.valor);
  const despesasTipo = data.porTipo
    .filter((t) => t.classificacao === 'despesa' && t.valor !== 0)
    .sort((a, b) => b.valor - a.valor);
  const operacoesTipo = data.porTipo
    .filter((t) => t.classificacao === 'operacao' && t.valor !== 0)
    .sort((a, b) => b.valor - a.valor);

  const pctOf = (v: number, total: number) => (total > 0 ? ((v / total) * 100).toFixed(1) + '%' : '—');

  if (receitasTipo.length > 0) {
    addSectionTitle('Receitas por tipo');
    table({
      head: [['Tipo', 'Valor', '% do total']],
      body: [
        ...receitasTipo.map((t) => [t.label, fmtBRL(t.valor), pctOf(t.valor, data.receitas)]),
        [
          { content: 'Total', styles: { fontStyle: 'bold' } },
          { content: fmtBRL(data.receitas), styles: { fontStyle: 'bold', textColor: SUCCESS } },
          { content: '100%', styles: { fontStyle: 'bold' } },
        ],
      ],
      columnStyles: { 1: { halign: 'right', cellWidth: 35 }, 2: { halign: 'right', cellWidth: 24 } },
    });
  }

  if (despesasTipo.length > 0) {
    addSectionTitle('Despesas por tipo');
    table({
      head: [['Tipo', 'Valor', '% do total']],
      body: [
        ...despesasTipo.map((t) => [t.label, fmtBRL(t.valor), pctOf(t.valor, data.despesas)]),
        [
          { content: 'Total', styles: { fontStyle: 'bold' } },
          { content: fmtBRL(data.despesas), styles: { fontStyle: 'bold', textColor: DANGER } },
          { content: '100%', styles: { fontStyle: 'bold' } },
        ],
      ],
      columnStyles: { 1: { halign: 'right', cellWidth: 35 }, 2: { halign: 'right', cellWidth: 24 } },
    });
  }

  if (operacoesTipo.length > 0) {
    addSectionTitle('Operações (não entram no resultado)');
    table({
      head: [['Tipo', 'Valor']],
      body: operacoesTipo.map((t) => [t.label, fmtBRL(t.valor)]),
      columnStyles: { 1: { halign: 'right', cellWidth: 35 } },
    });
  }

  // ───── 3. Recebíveis por forma de cobrança ─────
  if (data.recebiveis.length > 0) {
    const totalRec = data.recebiveis.reduce((s, r) => s + r.valor, 0);
    addSectionTitle('Recebíveis por forma de cobrança');
    table({
      head: [['Forma de cobrança', 'Valor', '% do total']],
      body: [
        ...data.recebiveis
          .slice()
          .sort((a, b) => b.valor - a.valor)
          .map((r) => [r.label, fmtBRL(r.valor), pctOf(r.valor, totalRec)]),
        [
          { content: 'Total', styles: { fontStyle: 'bold' } },
          { content: fmtBRL(totalRec), styles: { fontStyle: 'bold' } },
          { content: '100%', styles: { fontStyle: 'bold' } },
        ],
      ],
      columnStyles: { 1: { halign: 'right', cellWidth: 35 }, 2: { halign: 'right', cellWidth: 24 } },
    });
  }

  // ───── 4. Contas a pagar por categoria/favorecido ─────
  if (data.contasPagar.length > 0) {
    const totalPag = data.contasPagar.reduce((s, r) => s + r.valor, 0);
    addSectionTitle('Contas a pagar por categoria / favorecido');
    table({
      head: [['Categoria', 'Favorecido / descrição', 'Valor']],
      body: [
        ...data.contasPagar
          .slice()
          .sort((a, b) => b.valor - a.valor)
          .map((r) => [r.label, r.sub || '—', fmtBRL(r.valor)]),
        [
          { content: 'Total', colSpan: 2, styles: { fontStyle: 'bold' } },
          { content: fmtBRL(totalPag), styles: { fontStyle: 'bold', textColor: DANGER } },
        ],
      ],
      columnStyles: { 2: { halign: 'right', cellWidth: 35 } },
    });
  }

  // ───── 5. Comparação com o mês anterior ─────
  if (data.anterior) {
    const a = data.anterior;
    const vRec = variation(data.receitas, a.receitas);
    const vDes = variation(data.despesas, a.despesas);
    const vRes = variation(data.resultado, a.resultado);
    const vSal = variation(data.saldoFinal, a.saldoFinal);
    addSectionTitle(`Comparação com ${a.label}`);
    table({
      head: [['Indicador', 'Período atual', a.label, 'Variação', '%']],
      body: [
        ['Receitas', fmtBRL(data.receitas), fmtBRL(a.receitas), vRec.abs, vRec.pct],
        ['Despesas', fmtBRL(data.despesas), fmtBRL(a.despesas), vDes.abs, vDes.pct],
        ['Resultado', fmtBRL(data.resultado), fmtBRL(a.resultado), vRes.abs, vRes.pct],
        ['Saldo final', fmtBRL(data.saldoFinal), fmtBRL(a.saldoFinal), vSal.abs, vSal.pct],
      ],
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', cellWidth: 20 },
      },
    });
  }

  // Rodapé em todas as páginas (autoTable pode ter criado páginas extras)
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.setDrawColor(...BORDER);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN_X, PAGE_H - 12, PAGE_W - MARGIN_X, PAGE_H - 12);
    pdf.text(`${data.schoolName} · Gerado em ${geradoEm}`, MARGIN_X, PAGE_H - 7);
    pdf.text(`Página ${i} de ${total}`, PAGE_W - MARGIN_X, PAGE_H - 7, { align: 'right' });
  }

  pdf.save(`${data.fileName || 'projecao-mes-completo'}.pdf`);
}

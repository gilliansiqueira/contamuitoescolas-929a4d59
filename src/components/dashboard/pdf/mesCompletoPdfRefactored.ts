import { PdfEngine } from '@/utils/pdf/pdf-engine';
import { PDF_COLORS } from '@/utils/pdf/pdf-constants';
import { MesCompletoData, formatKpi } from './mesCompletoPdf'; // Reuse types

export async function generateMesCompletoPdfRefactored(data: MesCompletoData) {
  // Use 'l' for Landscape
  const engine = new PdfEngine('l'); 
  await engine.addHeader('RELATÓRIO FINANCEIRO CONSOLIDADO', data.periodoLabel);

  // 1. Resumo Executivo em Grid
  engine.sectionTitle('Indicadores Chave (KPIs)');
  engine.drawSmallMultiples(data.kpis.slice(0, 8), 4, 30, (kpi, x, y, w, h) => {
    const { pdf } = engine;
    pdf.setFillColor(...PDF_COLORS.SURFACE);
    pdf.roundedRect(x, y, w, h, 1, 1, 'F');
    pdf.setTextColor(...PDF_COLORS.MUTED);
    pdf.setFontSize(7);
    pdf.text(kpi.name.toUpperCase(), x + 4, y + 7);
    pdf.setTextColor(...PDF_COLORS.TEXT);
    pdf.setFontSize(12);
    pdf.text(formatKpi(kpi.value, kpi.valueType, kpi.decimals), x + 4, y + 17);
    
    // Mini chart within the multiple
    if (kpi.history && kpi.history.length > 1) {
      engine.drawMiniLineChart(
        kpi.history.map(h => h.value),
        x + 4, y + 20, w - 8, 6,
        kpi.value && kpi.value > 0 ? PDF_COLORS.SUCCESS : PDF_COLORS.DANGER
      );
    }
  });

  // 2. Approved Plan Structure (Practical proposal)
  engine.addPage('PLANO APROVADO E METAS');
  engine.sectionTitle('Distribuição Orçamentária');
  
  // Proposed landscape layout: 3 columns for Plan, Reality, Variance
  const colW = (engine.w - 2 * engine.marginX) / 3;
  // ... implementation of columns ...

  return engine.pdf.save(data.fileName || 'relatorio.pdf');
}

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDF_COLORS, PDF_DIMENSIONS } from './pdf-constants';

export type Orientation = 'p' | 'l';

export class PdfEngine {
  pdf: jsPDF;
  y: number;
  orientation: Orientation;
  w: number;
  h: number;
  marginX: number;
  logoUrl?: string;

  constructor(orientation: Orientation = 'p', logoUrl?: string) {
    this.orientation = orientation;
    this.pdf = new jsPDF(orientation, 'mm', 'a4');
    this.w = orientation === 'p' ? PDF_DIMENSIONS.PORTRAIT.w : PDF_DIMENSIONS.LANDSCAPE.w;
    this.h = orientation === 'p' ? PDF_DIMENSIONS.PORTRAIT.h : PDF_DIMENSIONS.LANDSCAPE.h;
    this.marginX = PDF_DIMENSIONS.MARGIN_X;
    this.y = PDF_DIMENSIONS.MARGIN_Y;
    this.logoUrl = logoUrl;
  }

  // --- Pagination Safeguards ---
  ensureSpace(height: number, titleForNewPage?: string) {
    if (this.y + height > this.h - PDF_DIMENSIONS.FOOTER_H) {
      this.addPage(titleForNewPage);
      return true;
    }
    return false;
  }

  addPage(title?: string) {
    this.pdf.addPage();
    this.y = PDF_DIMENSIONS.MARGIN_Y;
    if (title) this.addHeader(title);
  }

  addHeader(title: string, subtitle?: string) {
    const { PRIMARY_DARK, ACCENT, WHITE } = PDF_COLORS;
    this.pdf.setFillColor(...PRIMARY_DARK);
    this.pdf.rect(0, 0, this.w, 31, 'F');
    this.pdf.setFillColor(...ACCENT);
    this.pdf.rect(0, 31, this.w, 1.4, 'F');
    
    if (this.logoUrl) {
      try { this.pdf.addImage(this.logoUrl, 'PNG', this.marginX, 7, 34, 16); } catch {}
    }

    this.pdf.setTextColor(...WHITE);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(13);
    this.pdf.text(title, this.logoUrl ? 55 : this.marginX, 14);
    
    if (subtitle) {
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setFontSize(8);
      this.pdf.text(subtitle, this.logoUrl ? 55 : this.marginX, 21);
    }
    this.y = 42;
  }

  sectionTitle(title: string, note?: string) {
    this.ensureSpace(12, title);
    const { ACCENT, TEXT, MUTED } = PDF_COLORS;
    this.pdf.setFillColor(...ACCENT);
    this.pdf.rect(this.marginX, this.y - 3.8, 1.6, 5.5, 'F');
    this.pdf.setTextColor(...TEXT);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(11);
    this.pdf.text(title, this.marginX + 4, this.y);
    if (note) {
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setFontSize(7.5);
      this.pdf.setTextColor(...MUTED);
      this.pdf.text(note, this.w - this.marginX, this.y, { align: 'right' });
    }
    this.y += 8;
  }

  // --- Small-Multiples Layout ---
  drawGrid<T>(
    items: T[],
    cols: number,
    rowHeight: number,
    drawFn: (item: T, x: number, y: number, width: number, height: number) => void
  ) {
    const gap = 4;
    const itemW = (this.w - (2 * this.marginX) - (cols - 1) * gap) / cols;
    
    items.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      if (col === 0 && i > 0) {
        this.y += rowHeight + gap;
        this.ensureSpace(rowHeight);
      }
      const x = this.marginX + col * (itemW + gap);
      drawFn(item, x, this.y, itemW, rowHeight);
    });
    this.y += rowHeight + gap;
  }

  // --- Reusable Charts ---
  drawMiniLine(values: number[], x: number, y: number, w: number, h: number, color = PDF_COLORS.PRIMARY) {
    const min = Math.min(0, ...values);
    const max = Math.max(1, ...values);
    const span = max - min || 1;
    this.pdf.setDrawColor(...PDF_COLORS.BORDER);
    this.pdf.setLineWidth(0.1);
    this.pdf.line(x, y + h, x + w, y + h);
    this.pdf.setDrawColor(...color);
    this.pdf.setLineWidth(0.6);
    values.forEach((v, i) => {
      const px = x + (i * w) / (values.length - 1 || 1);
      const py = y + h - ((v - min) / span) * h;
      if (i > 0) {
        const prevX = x + ((i - 1) * w) / (values.length - 1 || 1);
        const prevY = y + h - ((values[i - 1] - min) / span) * h;
        this.pdf.line(prevX, prevY, px, py);
      }
    });
  }

  // --- Approved Plan Specific: 3-Column Comparison ---
  drawPlanComparison(label: string, planned: number, actual: number, x: number, y: number, w: number) {
    const { TEXT, MUTED, SUCCESS, DANGER } = PDF_COLORS;
    const diff = actual - planned;
    const pct = planned ? (diff / planned) * 100 : 0;
    
    this.pdf.setFontSize(8);
    this.pdf.setTextColor(...TEXT);
    this.pdf.text(label, x, y);
    
    this.pdf.setFontSize(7);
    this.pdf.setTextColor(...MUTED);
    this.pdf.text(`Prev: ${planned.toLocaleString()}`, x, y + 5);
    this.pdf.text(`Real: ${actual.toLocaleString()}`, x + (w/3), y + 5);
    
    this.pdf.setTextColor(...(diff >= 0 ? SUCCESS : DANGER));
    this.pdf.text(`${diff >= 0 ? '+' : ''}${pct.toFixed(1)}%`, x + (2*w/3), y + 5, { align: 'right' });
  }
}

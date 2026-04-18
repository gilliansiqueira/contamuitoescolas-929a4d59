import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Generate a PDF from a container that has multiple `.pdf-page` children.
 * Each `.pdf-page` will be rendered as its own A4 page (no awkward content cutting).
 * Falls back to splitting a single tall element if no .pdf-page children exist.
 */
export async function generatePdfFromElement(element: HTMLElement, fileName: string) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = 210;
  const pdfHeight = 297;

  const pages = Array.from(element.querySelectorAll<HTMLElement>('.pdf-page'));

  if (pages.length > 0) {
    // Render each .pdf-page as its own page
    for (let i = 0; i < pages.length; i++) {
      const pageEl = pages[i];
      const canvas = await html2canvas(pageEl, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: pageEl.style.backgroundColor || '#ffffff',
        windowWidth: pageEl.scrollWidth,
        windowHeight: pageEl.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/png');
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      if (i > 0) pdf.addPage();

      // Fit to page height if it overflows; otherwise center vertically
      if (imgHeight <= pdfHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight, undefined, 'FAST');
      } else {
        // Scale down to fit page height, center horizontally
        const scaledWidth = (canvas.width * pdfHeight) / canvas.height;
        const offsetX = (pdfWidth - scaledWidth) / 2;
        pdf.addImage(imgData, 'PNG', offsetX, 0, scaledWidth, pdfHeight, undefined, 'FAST');
      }
    }
  } else {
    // Fallback: capture whole element and split
    const canvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: null,
    });
    const imgData = canvas.toDataURL('image/png');
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;
    }
  }

  pdf.save(fileName);
}

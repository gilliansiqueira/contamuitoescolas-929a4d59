import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function generatePdfFromElement(element: HTMLElement, fileName: string) {
  // Capture the canvas with good scaling for high resolution text/images
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: null, // Transparent to keep the element's own background
  });

  const imgData = canvas.toDataURL('image/png');

  // A4 dimensions at 72 PPI (points)
  const pdfWidth = 210;
  const pdfHeight = 297;
  
  // Calculate scaled height based on the canvas aspect ratio
  const imgWidth = 210; 
  const imgHeight = (canvas.height * pdfWidth) / canvas.width;
  
  const pdf = new jsPDF('p', 'mm', 'a4');
  
  let heightLeft = imgHeight;
  let position = 0;

  // Add the first page
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pdfHeight;

  // If the image is taller than A4, add pages
  while (heightLeft >= 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;
  }

  pdf.save(fileName);
}

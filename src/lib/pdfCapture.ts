/**
 * Captura genérica de qualquer área da tela para PDF.
 *
 * Regras:
 *  - Expande temporariamente todos os containers com scroll (overflow auto/scroll)
 *    e alturas/larguras fixas, para capturar 100% do conteúdo.
 *  - Restaura todos os estilos originais ao final (mesmo em caso de erro).
 *  - Escolhe automaticamente retrato/paisagem conforme a proporção do conteúdo.
 *  - Pagina verticalmente quantas páginas forem necessárias.
 *  - Escala mínima de 2x para manter o texto nítido.
 */

interface Saved {
  node: HTMLElement;
  cssText: string;
  scrollLeft: number;
  scrollTop: number;
}

function isScrollable(el: HTMLElement) {
  const cs = getComputedStyle(el);
  return /(auto|scroll|hidden)/.test(cs.overflow + cs.overflowX + cs.overflowY);
}

function expand(root: HTMLElement): Saved[] {
  const saved: Saved[] = [];
  const nodes: HTMLElement[] = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];

  for (const node of nodes) {
    if (node !== root && !isScrollable(node)) continue;
    saved.push({
      node,
      cssText: node.style.cssText,
      scrollLeft: node.scrollLeft,
      scrollTop: node.scrollTop,
    });
    node.style.overflow = 'visible';
    node.style.overflowX = 'visible';
    node.style.overflowY = 'visible';
    node.style.maxHeight = 'none';
    node.style.maxWidth = 'none';
    if (node !== root) {
      const cs = getComputedStyle(node);
      if (cs.height !== 'auto' && node.scrollHeight > node.clientHeight) node.style.height = 'auto';
    }
  }

  // O elemento raiz precisa ficar com o tamanho real do conteúdo
  saved.push({ node: root, cssText: root.style.cssText, scrollLeft: 0, scrollTop: 0 });
  root.style.width = `${Math.max(root.scrollWidth, root.clientWidth)}px`;
  root.style.height = 'auto';

  return saved;
}

function restore(saved: Saved[]) {
  for (let i = saved.length - 1; i >= 0; i--) {
    const s = saved[i];
    s.node.style.cssText = s.cssText;
    s.node.scrollLeft = s.scrollLeft;
    s.node.scrollTop = s.scrollTop;
  }
}

export async function exportElementToPdf(el: HTMLElement, fileName = 'relatorio') {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const saved = expand(el);
  // Marca os campos de formulário para reencontrá-los no clone do html2canvas
  const fields = Array.from(el.querySelectorAll<HTMLElement>('input, textarea, select'));
  fields.forEach((f, i) => f.setAttribute('data-pdf-field', String(i)));
  let canvas: HTMLCanvasElement;
  try {
    // Aguarda o reflow depois da expansão
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));


    const fullWidth = Math.ceil(Math.max(el.scrollWidth, el.offsetWidth));
    const fullHeight = Math.ceil(Math.max(el.scrollHeight, el.offsetHeight));

    canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
      width: fullWidth,
      height: fullHeight,
      windowWidth: Math.max(fullWidth, document.documentElement.clientWidth),
      windowHeight: Math.max(fullHeight, document.documentElement.clientHeight),
      scrollX: 0,
      scrollY: 0,
      onclone: (doc) => {
        doc.querySelectorAll('[data-export-hide]').forEach((n) => {
          (n as HTMLElement).style.display = 'none';
        });

        // O html2canvas não renderiza corretamente o texto de campos de
        // formulário (o React define o valor por propriedade e o texto sai
        // cortado/em branco). Substituímos cada campo por um bloco de texto
        // equivalente no clone, preservando o visual.
        const originals = Array.from(
          el.querySelectorAll<HTMLElement>('input, textarea, select'),
        );
        originals.forEach((orig, i) => {
          const clone = doc.querySelector<HTMLElement>(`[data-pdf-field="${i}"]`);
          if (!clone) return;

          if (orig instanceof HTMLInputElement && (orig.type === 'checkbox' || orig.type === 'radio')) {
            (clone as HTMLInputElement).checked = orig.checked;
            if (orig.checked) clone.setAttribute('checked', '');
            else clone.removeAttribute('checked');
            return;
          }

          let text = '';
          if (orig instanceof HTMLSelectElement) {
            text = orig.selectedOptions[0]?.text ?? '';
          } else {
            text = (orig as HTMLInputElement | HTMLTextAreaElement).value ?? '';
          }

          const cs = getComputedStyle(orig);
          const rect = orig.getBoundingClientRect();
          const box = doc.createElement('div');
          box.textContent = text;
          box.style.cssText = [
            `width:${rect.width}px`,
            `min-height:${rect.height}px`,
            `font:${cs.font}`,
            `font-family:${cs.fontFamily}`,
            `font-size:${cs.fontSize}`,
            `font-weight:${cs.fontWeight}`,
            `color:${cs.color}`,
            `text-align:${cs.textAlign}`,
            `padding:${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
            `border:${cs.border}`,
            `border-radius:${cs.borderRadius}`,
            `background:${cs.backgroundColor}`,
            `box-sizing:border-box`,
            `white-space:pre-wrap`,
            `overflow:hidden`,
            `display:flex`,
            `align-items:center`,
            `justify-content:${
              cs.textAlign === 'right' ? 'flex-end' : cs.textAlign === 'center' ? 'center' : 'flex-start'
            }`,
          ].join(';');
          clone.replaceWith(box);
        });

      },

    });
  } finally {
    fields.forEach((f) => f.removeAttribute('data-pdf-field'));
    restore(saved);
  }


  // Paisagem quando o conteúdo é mais largo do que alto (evita reduzir demais)
  const landscape = canvas.width / canvas.height > 1.15;
  const pdf = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;

  // Toda a largura sempre cabe: a escala é definida pela largura da página
  const ratio = contentW / canvas.width;
  const sliceHeightPx = Math.floor(contentH / ratio); // altura (em px do canvas) por página

  let offset = 0;
  let first = true;

  while (offset < canvas.height) {
    const h = Math.min(sliceHeightPx, canvas.height - offset);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = h;
    const ctx = slice.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, offset, canvas.width, h, 0, 0, canvas.width, h);
    }

    if (!first) pdf.addPage(undefined, landscape ? 'landscape' : 'portrait');
    pdf.addImage(
      slice.toDataURL('image/jpeg', 0.95),
      'JPEG',
      margin,
      margin,
      contentW,
      h * ratio,
      undefined,
      'FAST',
    );

    first = false;
    offset += h;
  }

  pdf.save(`${fileName}.pdf`);
}

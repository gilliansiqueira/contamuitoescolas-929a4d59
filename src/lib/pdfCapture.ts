/**
 * Captura genérica de qualquer área da tela para PDF.
 *
 * Regras:
 *  - Expande temporariamente todos os containers com scroll (overflow auto/scroll),
 *    incluindo viewports do Radix ScrollArea, e alturas/larguras fixas.
 *  - Neutraliza position:sticky (thead/tfoot fixos) para não sobrepor conteúdo.
 *  - Restaura todos os estilos originais ao final (mesmo em caso de erro).
 *  - Reduz a escala (nunca abaixo de 1.5x) quando o canvas ultrapassa o limite
 *    seguro do navegador; se ainda assim não couber, captura em fatias verticais.
 *  - Pagina verticalmente quantas páginas forem necessárias.
 */

interface Saved {
  node: HTMLElement;
  cssText: string;
  scrollLeft: number;
  scrollTop: number;
}

const MAX_DIMENSION = 16000; // px por dimensão do canvas
const MAX_AREA = 16000 * 8000; // área total segura
const MIN_SCALE = 1.5;
const DEFAULT_SCALE = 2;

function isScrollable(el: HTMLElement) {
  const cs = getComputedStyle(el);
  return /(auto|scroll|hidden)/.test(cs.overflow + cs.overflowX + cs.overflowY);
}

function expand(root: HTMLElement): Saved[] {
  const saved: Saved[] = [];
  const push = (node: HTMLElement) => {
    saved.push({
      node,
      cssText: node.style.cssText,
      scrollLeft: node.scrollLeft,
      scrollTop: node.scrollTop,
    });
  };

  const nodes: HTMLElement[] = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];

  for (const node of nodes) {
    const cs = getComputedStyle(node);
    const sticky = cs.position === 'sticky';
    const radixViewport = node.hasAttribute('data-radix-scroll-area-viewport');
    const scrollable = isScrollable(node);

    if (node !== root && !sticky && !radixViewport && !scrollable) continue;

    push(node);

    // 1) Sticky: desenha na posição real do documento
    if (sticky) {
      node.style.position = 'static';
      node.style.top = 'auto';
      node.style.bottom = 'auto';
      node.style.left = 'auto';
      node.style.right = 'auto';
      node.style.inset = 'auto';
      node.style.zIndex = 'auto';
    }

    if (scrollable || radixViewport || node === root) {
      node.style.overflow = 'visible';
      node.style.overflowX = 'visible';
      node.style.overflowY = 'visible';
      node.style.maxHeight = 'none';
      node.style.maxWidth = 'none';
    }

    // 3) Radix ScrollArea viewport: expande para o tamanho real
    if (radixViewport) {
      node.style.height = `${node.scrollHeight}px`;
      node.style.width = `${Math.max(node.scrollWidth, node.clientWidth)}px`;
      // wrapper interno com display:table limita a largura
      const inner = node.firstElementChild as HTMLElement | null;
      if (inner && getComputedStyle(inner).display === 'table') {
        push(inner);
        inner.style.display = 'block';
        inner.style.minWidth = '100%';
        inner.style.width = 'auto';
      }
    } else if (node !== root && scrollable) {
      if (cs.height !== 'auto' && node.scrollHeight > node.clientHeight) node.style.height = 'auto';
    }
  }

  // Também neutraliza sticky em thead/tfoot/th/td (alguns navegadores só reportam
  // no elemento da célula)
  root.querySelectorAll<HTMLElement>('thead, tfoot, tr, th, td').forEach((cell) => {
    if (getComputedStyle(cell).position === 'sticky') {
      push(cell);
      cell.style.position = 'static';
      cell.style.top = 'auto';
      cell.style.bottom = 'auto';
      cell.style.inset = 'auto';
      cell.style.zIndex = 'auto';
    }
  });

  // O elemento raiz precisa ficar com o tamanho real do conteúdo
  push(root);
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

function buildOnClone(el: HTMLElement) {
  return (doc: Document) => {
    doc.querySelectorAll('[data-export-hide]').forEach((n) => {
      (n as HTMLElement).style.display = 'none';
    });

    // Segurança extra: qualquer sticky remanescente no clone
    doc.querySelectorAll<HTMLElement>('*').forEach((n) => {
      if (n.style.position === 'sticky') {
        n.style.position = 'static';
        n.style.inset = 'auto';
        n.style.zIndex = 'auto';
      }
    });

    // O html2canvas não renderiza corretamente o texto de campos de
    // formulário (o React define o valor por propriedade e o texto sai
    // cortado/em branco). Substituímos cada campo por um bloco de texto
    // equivalente no clone, preservando o visual.
    const originals = Array.from(el.querySelectorAll<HTMLElement>('input, textarea, select'));
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
  };
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

  let canvases: { canvas: HTMLCanvasElement; scale: number }[] = [];
  let fullWidth = 0;
  let fullHeight = 0;

  try {
    // Aguarda o reflow depois da expansão
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    fullWidth = Math.ceil(Math.max(el.scrollWidth, el.offsetWidth));
    fullHeight = Math.ceil(Math.max(el.scrollHeight, el.offsetHeight));

    // 2) Limite de canvas: reduz escala até caber (nunca abaixo de 1.5x)
    let scale = DEFAULT_SCALE;
    const fits = (s: number) =>
      fullWidth * s <= MAX_DIMENSION && fullHeight * s <= MAX_DIMENSION && fullWidth * s * fullHeight * s <= MAX_AREA;
    while (scale > MIN_SCALE && !fits(scale)) {
      scale = Math.max(MIN_SCALE, +(scale - 0.1).toFixed(2));
    }

    const base = {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
      windowWidth: Math.max(fullWidth, document.documentElement.clientWidth),
      windowHeight: Math.max(fullHeight, document.documentElement.clientHeight),
      scrollX: 0,
      scrollY: 0,
      onclone: buildOnClone(el),
    } as const;

    if (fits(scale)) {
      const canvas = await html2canvas(el, {
        ...base,
        width: fullWidth,
        height: fullHeight,
      });
      canvases = [{ canvas, scale }];
    } else {
      // Fatias verticais: cada fatia respeita os limites do canvas
      const maxSliceH = Math.floor(
        Math.min(MAX_DIMENSION / scale, MAX_AREA / (fullWidth * scale * scale)),
      );
      const sliceH = Math.max(200, maxSliceH);
      for (let y = 0; y < fullHeight; y += sliceH) {
        const h = Math.min(sliceH, fullHeight - y);
        const canvas = await html2canvas(el, {
          ...base,
          y,
          height: h,
          width: fullWidth,
        } as any);
        canvases.push({ canvas, scale });
      }
    }
  } finally {
    fields.forEach((f) => f.removeAttribute('data-pdf-field'));
    restore(saved);
  }

  // 4) Validação leve
  const capturedHeight = canvases.reduce((s, c) => s + c.canvas.height / c.scale, 0);
  if (Math.abs(capturedHeight - fullHeight) > Math.max(20, fullHeight * 0.02)) {
    console.warn(
      `[pdfCapture] "${fileName}": altura capturada (${Math.round(capturedHeight)}px) difere do conteúdo esperado (${fullHeight}px). Parte do relatório pode estar cortada.`,
    );
  }

  const canvasWidth = canvases[0]?.canvas.width ?? 1;
  const totalCanvasHeight = canvases.reduce((s, c) => s + c.canvas.height, 0);

  // Paisagem quando o conteúdo é mais largo do que alto (evita reduzir demais)
  const landscape = canvasWidth / totalCanvasHeight > 1.15;
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
  const ratio = contentW / canvasWidth;
  const sliceHeightPx = Math.floor(contentH / ratio); // altura (em px do canvas) por página

  let first = true;

  for (const { canvas } of canvases) {
    let offset = 0;
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
  }

  pdf.save(`${fileName}.pdf`);
}

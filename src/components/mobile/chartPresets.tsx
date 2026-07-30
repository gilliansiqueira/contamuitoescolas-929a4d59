import { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * Presets de apresentação de gráficos para mobile:
 * - altura menor, margens internas reduzidas
 * - menos labels no eixo X
 * - legendas ocultas
 * - rolagem horizontal quando há muitas categorias
 */
export function useChartPresets(pointCount = 0) {
  const isMobile = useIsMobile();
  const minWidthPerPoint = 56;
  const needsScroll = isMobile && pointCount > 6;
  return {
    isMobile,
    height: isMobile ? 200 : 260,
    tallHeight: isMobile ? 220 : 288,
    showLegend: !isMobile,
    tickFontSize: isMobile ? 9 : 10,
    margin: isMobile ? { top: 8, right: 4, bottom: 0, left: -18 } : { top: 8, right: 8, bottom: 0, left: 0 },
    /** intervalo de ticks do eixo X para não sobrepor rótulos */
    xInterval: isMobile ? (pointCount > 8 ? Math.ceil(pointCount / 5) : 0) : 0,
    needsScroll,
    scrollWidth: needsScroll ? Math.max(pointCount * minWidthPerPoint, 320) : undefined,
  };
}

/** Contêiner que permite rolagem horizontal do gráfico no mobile. */
export function ChartScroller({
  children, width, height,
}: { children: ReactNode; width?: number; height: number }) {
  if (!width) {
    return <div style={{ height }}>{children}</div>;
  }
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div style={{ width, height }}>{children}</div>
    </div>
  );
}

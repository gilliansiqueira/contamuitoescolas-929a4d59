export type ColKind = 'imported' | 'calculated' | 'manual';
export type ColType = 'text' | 'date' | 'number' | 'list';

/** Coluna da planilha. `id` é estável: renomear/mover não muda a regra (field/source). */
export interface RenewalColumn {
  id: string;
  title: string;
  kind: ColKind;
  type: ColType;
  /** Campo canônico preenchido pela regra (ex.: 'aluno', 'venc_ultima_parcela'). */
  field?: string;
  source?: string;
  options?: string[];
  width?: number;
  hidden?: boolean;
  /** Sem regra validada: aparece como dúvida. */
  doubt?: string;
}

export interface SummaryBlock {
  /** Agrupamentos do quadro de resumo encontrados no modelo. */
  byProfessor: boolean;
  byStatus: boolean;
  bySituacao: boolean;
  formulas: string[];
}

export interface TemplateStructure {
  sheets: string[];
  mainSheet: string;
  columns: RenewalColumn[];
  summary: SummaryBlock;
  headerColor?: string;
  separateModalities: boolean;
  notes: string[];
}

export interface Override { value: any; original: any; by?: string; at: string }

export interface RenewalRow {
  id?: string;
  row_key: string;
  imported: Record<string, any>;
  overrides: Record<string, Override>;
  conflicts: Record<string, { imported: any; manual: any }>;
  sort_order: number;
  manual: boolean;
}

export interface Issue { kind: string; row_key?: string; message: string; detail?: any }

export interface RenewalSettings {
  include_material: boolean;
  module_categories: string[];
  separate_modalities: string[];
}

export const SHEET_STATUS: { key: string; label: string }[] = [
  { key: 'aguardando_relatorios', label: 'Aguardando relatórios' },
  { key: 'em_preparacao', label: 'Em preparação' },
  { key: 'em_revisao', label: 'Em revisão' },
  { key: 'pronta_envio', label: 'Pronta para envio' },
  { key: 'enviada', label: 'Enviada' },
  { key: 'alteracao_solicitada', label: 'Alteração solicitada' },
];

export const A_CONFIRMAR = 'A confirmar';
export const SEM_INFO = 'Sem informação';

export function cellValue(row: RenewalRow, col: RenewalColumn): any {
  const o = row.overrides?.[col.id];
  if (o) return o.value;
  return col.field ? row.imported?.[col.field] : undefined;
}

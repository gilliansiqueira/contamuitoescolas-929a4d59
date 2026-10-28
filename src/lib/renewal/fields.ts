import type { RenewalColumn, ColKind, ColType } from './types';

interface FieldDef { field: string; title: string; kind: ColKind; type: ColType; source?: string; aliases: string[]; options?: string[]; optionColors?: Record<string, string>; renewedOptions?: string[] }

export const STATUS_OPTIONS = ['Renovado', 'Pendente', 'Aguardando Retorno', 'Não Rematriculará'];
export const SITUACAO_OPTIONS = ['Follow Lançado', 'Planejamento Enviado', 'Lançamento Autorizado', 'Cont. Ass. c/ Pendência Finan.', 'Contrato Lançado no Sistema'];
export const STATUS_COLORS: Record<string, string> = { 'Renovado': 'FF00B0F0', 'Rematriculado': 'FF00B0F0', 'Pendente': 'FFFBD5B5', 'Aguardando Retorno': 'FFD9D9D9', 'Não Rematriculará': 'FFFF0000' };
export const SITUACAO_COLORS: Record<string, string> = { 'Follow Lançado': 'FFDBEEF4', 'Planejamento Enviado': 'FFE6B9B8', 'Lançamento Autorizado': 'FFB3A2C7', 'Cont. Ass. c/ Pendência Finan.': 'FFB97034', 'Contrato Lançado no Sistema': 'FF00B050', 'Rematriculado sem pendências': 'FF92D050' };

/** Coluna de lista sem cores configuradas usa as cores padrão do catálogo (tela e Excel nunca saem sem cor). */
export function withFieldDefaults(col: RenewalColumn): RenewalColumn {
  const def = FIELDS.find(f => f.field === col.field);
  if (!def?.optionColors || col.type !== 'list') return col;
  const options = col.options?.length ? col.options : def.options;
  const optionColors = { ...Object.fromEntries((options ?? []).filter(o => def.optionColors![o]).map(o => [o, def.optionColors![o]])), ...(col.optionColors ?? {}) };
  return { ...col, options, optionColors };
}

const T = 'turmas_existentes';
/** Catálogo de campos conhecidos e regras de preenchimento validadas (ordem = ordem padrão do Sponte). */
export const FIELDS: FieldDef[] = [
  { field: 'turma', title: 'Turma', kind: 'imported', type: 'text', source: T, aliases: ['turma', 'nome turma'] },
  { field: 'curso', title: 'Curso', kind: 'imported', type: 'text', source: T, aliases: ['curso'] },
  { field: 'estagio', title: 'Estágio', kind: 'imported', type: 'text', source: T, aliases: ['estagio'] },
  { field: 'professor', title: 'Professor', kind: 'imported', type: 'text', source: T, aliases: ['professor', 'professora'] },
  { field: 'sala', title: 'Sala', kind: 'imported', type: 'text', source: T, aliases: ['sala'] },
  { field: 'modalidade', title: 'Modalidade', kind: 'imported', type: 'text', source: T, aliases: ['modalidade'] },
  { field: 'data_inicio', title: 'Data início', kind: 'imported', type: 'date', source: T, aliases: ['datainicio', 'data inicio'] },
  { field: 'data_termino', title: 'Data término', kind: 'imported', type: 'date', source: T, aliases: ['datatermino', 'data termino'] },
  { field: 'integrantes', title: 'Integrantes atuais', kind: 'imported', type: 'number', source: T, aliases: ['integrantesatuais', 'integrantes atuais', 'integrantes'] },
  { field: 'aluno', title: 'Aluno', kind: 'imported', type: 'text', source: T, aliases: ['aluno', 'nome do aluno', 'nome aluno'] },
  { field: 'matricula', title: 'Matrícula', kind: 'imported', type: 'text', source: T, aliases: ['matricula', 'numeromatricula', 'n matricula'] },
  { field: 'fone_residencial', title: 'Fone residencial', kind: 'imported', type: 'text', source: T, aliases: ['foneresidencial', 'fone residencial'] },
  { field: 'fone_celular', title: 'Fone celular', kind: 'imported', type: 'text', source: T, aliases: ['fonecelular', 'fone celular', 'celular'] },
  { field: 'bolsa', title: 'Bolsa', kind: 'imported', type: 'text', source: T, aliases: ['bolsa'] },
  { field: 'termino_contrato', title: 'Término do contrato', kind: 'imported', type: 'date', source: T, aliases: ['terminocontrato', 'termino contrato', 'termino do contrato'] },
  { field: 'email', title: 'E-mail', kind: 'imported', type: 'text', source: T, aliases: ['email', 'e mail'] },
  { field: 'numero_contrato', title: 'Nº contrato', kind: 'imported', type: 'text', source: T, aliases: ['numerocontrato', 'numero contrato', 'n contrato', 'contrato'] },
  { field: 'situacao_aluno', title: 'Situação do aluno', kind: 'imported', type: 'text', source: T, aliases: ['situacaoaluno', 'situacao aluno'] },
  { field: 'dias', title: 'Dias', kind: 'imported', type: 'text', source: T, aliases: ['dias'] },
  { field: 'horario', title: 'Horário', kind: 'imported', type: 'text', source: T, aliases: ['horario'] },
  { field: 'semestre', title: 'Semestre', kind: 'imported', type: 'text', source: T, aliases: ['semestre'] },
  { field: 'forma_pagamento_atual', title: 'Forma de pgto atual', kind: 'calculated', type: 'text', source: 'contas_receber', aliases: ['forma de pgto atual', 'forma pagamento atual', 'forma de pagamento atual'] },
  { field: 'venc_ultima_parcela', title: 'Venc. última parcela', kind: 'calculated', type: 'date', source: 'contas_receber', aliases: ['venc ultima parcela', 'vencimento ultima parcela', 'ultima parcela', 'ultimo vencimento'] },
  { field: 'termino_pagamento', title: 'Término do pagamento', kind: 'calculated', type: 'text', source: 'contas_receber', aliases: ['termino do pagamento', 'termino pagamento'] },
  { field: 'status_renovacao', title: 'Status Renovação', kind: 'manual', type: 'list', options: STATUS_OPTIONS, optionColors: STATUS_COLORS, renewedOptions: ['Renovado'], aliases: ['status renovacao', 'status'] },
  { field: 'situacao_contrato', title: 'Situação do Contrato', kind: 'manual', type: 'list', options: SITUACAO_OPTIONS, optionColors: SITUACAO_COLORS, aliases: ['situacao do contrato', 'situacao contrato'] },
  { field: 'teacher', title: 'Teacher', kind: 'manual', type: 'text', aliases: ['teacher'] },
  { field: 'turma_destino', title: 'Turma de destino', kind: 'manual', type: 'text', aliases: ['turma de destino', 'turma destino'] },
  { field: 'forma_pagamento_negociada', title: 'Forma de pgto negociada', kind: 'manual', type: 'text', aliases: ['forma de pgto negociada', 'pagamento negociado', 'forma negociada', 'forma de pgmt', 'forma de pagamento', 'forma pgto'] },
  { field: 'data_pagamento', title: 'Data pgto', kind: 'manual', type: 'date', aliases: ['data pgmt', 'data pgto', 'data pagamento'] },
  { field: 'data_rematricula', title: 'Data Remat.', kind: 'manual', type: 'date', aliases: ['data remat', 'data rematricula', 'data da rematricula'] },
  { field: 'responsavel', title: 'Responsável', kind: 'manual', type: 'text', aliases: ['responsavel'] },
  { field: 'observacoes', title: 'Observações', kind: 'manual', type: 'text', aliases: ['observacoes', 'obs', 'observacao'] },
];

export const norm = (s: any) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

let seq = 0;
export const newColId = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Reconhece um título do modelo. Título com sufixo (ex.: "Turma de Destino 25/1") casa pelo prefixo. */
export function matchField(title: string, used: Set<string>): FieldDef | undefined {
  const t = norm(title);
  const exact = FIELDS.find(f => !used.has(f.field) && f.aliases.some(a => a === t));
  if (exact) return exact;
  return FIELDS.find(f => !used.has(f.field) && f.aliases.some(a => a.length >= 5 && t.startsWith(a)));
}

export function columnFromField(field: string, title?: string): RenewalColumn {
  const f = FIELDS.find(x => x.field === field)!;
  return { id: newColId(), title: title ?? f.title, kind: f.kind, type: f.type, field: f.field, source: f.source, options: f.options && [...f.options], optionColors: f.optionColors && { ...f.optionColors }, renewedOptions: f.renewedOptions && [...f.renewedOptions] };
}

const DEFAULT_HIDDEN = new Set(['sala', 'data_inicio', 'data_termino', 'fone_residencial', 'fone_celular', 'bolsa', 'email', 'situacao_aluno', 'teacher', 'data_pagamento', 'responsavel']);
export function defaultColumns(): RenewalColumn[] {
  return FIELDS.map(f => ({ ...columnFromField(f.field), ...(DEFAULT_HIDDEN.has(f.field) ? { hidden: true } : {}) }));
}

/** Completa um modelo antigo com os campos novos do catálogo (ocultos), sem mexer no que já existe. */
export function withMissingFields(cols: RenewalColumn[]): RenewalColumn[] {
  const have = new Set(cols.map(c => c.field).filter(Boolean));
  return [...cols, ...FIELDS.filter(f => !have.has(f.field)).map(f => ({ ...columnFromField(f.field), hidden: true }))];
}

import type { RenewalColumn, ColKind, ColType } from './types';

interface FieldDef { field: string; title: string; kind: ColKind; type: ColType; source?: string; aliases: string[]; options?: string[] }

export const STATUS_OPTIONS = ['Rematriculado', 'Pendente', 'Não Rematriculará'];
export const SITUACAO_OPTIONS = ['Follow Lançado', 'Planejamento Enviado', 'Lançamento Autorizado', 'Cont. Ass. c/ Pendência Finan.', 'Contrato Lançado no Sistema', 'Rematriculado sem pendências'];

/** Catálogo de campos conhecidos e regras de preenchimento validadas. */
export const FIELDS: FieldDef[] = [
  { field: 'turma', title: 'Turma', kind: 'imported', type: 'text', source: 'turmas_existentes', aliases: ['turma', 'nome turma'] },
  { field: 'professor', title: 'Professor', kind: 'imported', type: 'text', source: 'turmas_existentes', aliases: ['professor', 'professora'] },
  { field: 'integrantes', title: 'Integrantes atuais', kind: 'imported', type: 'number', source: 'turmas_existentes', aliases: ['integrantesatuais', 'integrantes atuais', 'integrantes'] },
  { field: 'aluno', title: 'Aluno', kind: 'imported', type: 'text', source: 'turmas_existentes', aliases: ['aluno', 'nome do aluno', 'nome aluno'] },
  { field: 'matricula', title: 'Matrícula', kind: 'imported', type: 'text', source: 'turmas_existentes', aliases: ['matricula', 'numeromatricula', 'n matricula'] },
  { field: 'curso', title: 'Curso', kind: 'imported', type: 'text', source: 'turmas_existentes', aliases: ['curso'] },
  { field: 'estagio', title: 'Estágio', kind: 'imported', type: 'text', source: 'turmas_existentes', aliases: ['estagio'] },
  { field: 'modalidade', title: 'Modalidade', kind: 'imported', type: 'text', source: 'turmas_existentes', aliases: ['modalidade'] },
  { field: 'numero_contrato', title: 'Nº contrato', kind: 'imported', type: 'text', source: 'turmas_existentes', aliases: ['numerocontrato', 'numero contrato', 'n contrato', 'contrato'] },
  { field: 'termino_contrato', title: 'Término do contrato', kind: 'imported', type: 'date', source: 'turmas_existentes', aliases: ['terminocontrato', 'termino contrato', 'termino do contrato'] },
  { field: 'forma_pagamento_atual', title: 'Forma de pgto atual', kind: 'calculated', type: 'text', source: 'contas_receber', aliases: ['forma de pgmt', 'forma de pagamento', 'forma pgto', 'forma de pgto atual', 'forma pagamento atual'] },
  { field: 'venc_ultima_parcela', title: 'Venc. última parcela', kind: 'calculated', type: 'date', source: 'contas_receber', aliases: ['venc ultima parcela', 'vencimento ultima parcela', 'ultima parcela', 'ultimo vencimento'] },
  { field: 'termino_pagamento', title: 'Término do pagamento', kind: 'calculated', type: 'text', source: 'contas_receber', aliases: ['termino do pagamento', 'termino pagamento'] },
  { field: 'status_renovacao', title: 'Status Renovação', kind: 'manual', type: 'list', options: STATUS_OPTIONS, aliases: ['status renovacao', 'status'] },
  { field: 'situacao_contrato', title: 'Situação do Contrato', kind: 'manual', type: 'list', options: SITUACAO_OPTIONS, aliases: ['situacao do contrato', 'situacao contrato'] },
  { field: 'turma_destino', title: 'Turma de destino', kind: 'manual', type: 'text', aliases: ['turma de destino', 'turma destino'] },
  { field: 'forma_pagamento_negociada', title: 'Forma de pgto negociada', kind: 'manual', type: 'text', aliases: ['forma de pgto negociada', 'pagamento negociado', 'forma negociada'] },
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
  return { id: newColId(), title: title ?? f.title, kind: f.kind, type: f.type, field: f.field, source: f.source, options: f.options };
}

export function defaultColumns(): RenewalColumn[] {
  return FIELDS.map(f => columnFromField(f.field));
}

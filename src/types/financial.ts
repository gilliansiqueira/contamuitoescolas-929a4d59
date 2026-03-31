export interface FinancialEntry {
  id: string;
  data: string; // YYYY-MM-DD
  descricao: string;
  valor: number;
  tipo: 'entrada' | 'saida';
  categoria: string;
  origem: 'sponte' | 'cheque' | 'cartao' | 'manual' | 'fluxo' | 'contas_pagar' | 'simulacao';
  school_id: string;
  origem_upload_id?: string;
  tipoOriginal?: string; // raw "tipo" value from the source file
}

export interface School {
  id: string;
  nome: string;
  createdAt: string;
  saldoInicial?: number;
  saldoInicialData?: string; // YYYY-MM-DD base date
}

export interface ExclusionRule {
  id: string;
  school_id: string;
  tipo: 'receita' | 'despesa';
  campo: 'descricao' | 'categoria';
  operador: 'contem' | 'igual';
  valor: string;
  acao: 'ignorar' | 'recategorizar';
  novaCategoria?: string;
}

/** Flexible type classification per school for fluxo realizado entries */
export interface TypeClassification {
  id: string;
  school_id: string;
  tipoValor: string; // the raw value from the "tipo" column
  entraNoResultado: boolean; // counts towards resultado (receita/despesa)
  impactaCaixa: boolean; // impacts cash balance
  classificacao: 'receita' | 'despesa' | 'operacao' | 'ignorar';
  label: string; // display label
}

export interface SimulationScenario {
  id: string;
  school_id: string;
  nome: string;
  createdAt: string;
  matriculas: number;
  ticketMedio: number;
  inadimplencia: number;
  receitasExtras: FinancialEntry[];
  despesasExtras: FinancialEntry[];
}

export interface MonthlyClosing {
  id: string;
  school_id: string;
  mes: string; // YYYY-MM
  totalReceitas: number;
  totalDespesas: number;
  resultado: number;
  closedAt: string;
}

export interface CashFlowDay {
  data: string;
  entradas: number;
  saidas: number;
  saldoAnterior: number;
  saldoDia: number;
}

export interface ValidationError {
  linha: number;
  coluna: string;
  mensagem: string;
}

export interface UploadType {
  key: string;
  label: string;
  requiredColumns: string[];
  origem: FinancialEntry['origem'];
}

export interface UploadRecord {
  id: string;
  school_id: string;
  fileName: string;
  tipo: string; // upload type key
  uploadedAt: string;
  recordCount: number;
}

/** Payment method delay rules per school */
export interface PaymentDelayRule {
  id: string;
  school_id: string;
  formaCobranca: string; // e.g. 'Cartão de crédito', 'PIX', 'Boleto'
  prazo: number; // days to add
}

/** Audit log entry */
export interface AuditLogEntry {
  id: string;
  school_id: string;
  timestamp: string; // ISO
  action: 'upload' | 'edit' | 'delete' | 'delete_upload' | 'config';
  description: string;
}

export const UPLOAD_TYPES: UploadType[] = [
  {
    key: 'sponte',
    label: 'Sponte (Recebimentos)',
    requiredColumns: ['nome_aluno', 'valor', 'data_vencimento', 'tipo_pagamento'],
    origem: 'sponte',
  },
  {
    key: 'cheque',
    label: 'Cheques',
    requiredColumns: ['nome_aluno', 'valor', 'data_compensacao'],
    origem: 'cheque',
  },
  {
    key: 'cartao',
    label: 'Cartões (Maquininha)',
    requiredColumns: ['valor', 'data_recebimento', 'parcelas'],
    origem: 'cartao',
  },
  {
    key: 'contas_pagar',
    label: 'Contas a Pagar',
    requiredColumns: ['data_vencimento', 'valor', 'favorecido', 'categoria'],
    origem: 'contas_pagar',
  },
  {
    key: 'fluxo',
    label: 'Fluxo de Caixa Realizado',
    requiredColumns: ['data', 'descricao', 'valor', 'tipo'],
    origem: 'fluxo',
  },
];

export interface AppData {
  schools: School[];
  entries: FinancialEntry[];
  rules: ExclusionRule[];
  scenarios: SimulationScenario[];
  closings: MonthlyClosing[];
  uploads: UploadRecord[];
  typeClassifications?: TypeClassification[];
  paymentDelayRules?: PaymentDelayRule[];
  auditLog?: AuditLogEntry[];
}

// Fixed types that always count in resultado
export const FIXED_RESULT_TYPES = ['receita', 'despesa'];

// Default payment delay rules
export const DEFAULT_PAYMENT_DELAYS: { forma: string; prazo: number }[] = [
  { forma: 'PIX', prazo: 0 },
  { forma: 'Boleto', prazo: 0 },
  { forma: 'Cartão de crédito', prazo: 30 },
  { forma: 'Cartão de débito', prazo: 0 },
  { forma: 'Cheque', prazo: 0 },
];

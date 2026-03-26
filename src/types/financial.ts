export interface FinancialEntry {
  id: string;
  data: string; // YYYY-MM-DD
  descricao: string;
  valor: number;
  tipo: 'entrada' | 'saida';
  categoria: string;
  origem: 'sponte' | 'cheque' | 'cartao' | 'manual' | 'fluxo' | 'contas_pagar' | 'simulacao';
  school_id: string;
}

export interface School {
  id: string;
  nome: string;
  createdAt: string;
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

export interface SimulationScenario {
  id: string;
  school_id: string;
  nome: string;
  createdAt: string;
  matriculas: number;
  ticketMedio: number;
  inadimplencia: number; // percentage
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
}

import { describe, it, expect } from 'vitest';
import { resolveLedgerRule, getLedgerSaldoImpact, processLedger } from '../lib/ledgerEngine';
import type { FinancialEntry, TypeClassification } from '@/types/financial';

describe('Ledger Engine Centralized Financial Calculations', () => {
  const schoolId = 'empresa-test-id';

  it('deve validar Receita que diminui saldo (operacaoSinal = subtrair)', () => {
    // Cenário: Receita Inversa (Entra no resultado com sinal de subtrair)
    const classifications: TypeClassification[] = [
      {
        id: '1',
        school_id: schoolId,
        tipoValor: 'receita inversa',
        classificacao: 'receita',
        entraNoResultado: true,
        impactaCaixa: true,
        operacaoSinal: 'subtrair',
        label: 'Receita Inversa'
      } as any
    ];

    const rule = resolveLedgerRule('receita inversa', classifications);
    expect(rule.entraNoResultado).toBe(true);
    expect(rule.impactaCaixa).toBe(true);
    expect(rule.operacaoSinal).toBe('subtrair');

    const entry: FinancialEntry = {
      id: 'e1',
      data: '2026-05-01',
      descricao: 'Receita que subtrai',
      valor: 1000,
      tipo: 'entrada',
      categoria: 'fluxo_realizado',
      origem: 'fluxo',
      tipoOriginal: 'receita inversa',
      tipoRegistro: 'realizado',
      editadoManualmente: false,
      school_id: schoolId
    };

    // Impacto no saldo deve ser negativo (-1000)
    const impact = getLedgerSaldoImpact(entry, classifications);
    expect(impact).toBe(-1000);

    // Agregação dos totais
    const totals = processLedger([entry], classifications);
    // Como o sinal é subtrair, entra no resultado como despesa (reduz resultado)
    expect(totals.receitas).toBe(0);
    expect(totals.despesas).toBe(1000);
    expect(totals.resultado).toBe(-1000);
    expect(totals.saldoMovimento).toBe(-1000);
  });

  it('deve validar Despesa que aumenta saldo (operacaoSinal = somar)', () => {
    // Cenário: Despesa Inversa (Entra no resultado com sinal de somar)
    const classifications: TypeClassification[] = [
      {
        id: '2',
        school_id: schoolId,
        tipoValor: 'despesa inversa',
        classificacao: 'despesa',
        entraNoResultado: true,
        impactaCaixa: true,
        operacaoSinal: 'somar',
        label: 'Despesa Inversa'
      } as any
    ];

    const rule = resolveLedgerRule('despesa inversa', classifications);
    expect(rule.entraNoResultado).toBe(true);
    expect(rule.impactaCaixa).toBe(true);
    expect(rule.operacaoSinal).toBe('somar');

    const entry: FinancialEntry = {
      id: 'e2',
      data: '2026-05-01',
      descricao: 'Despesa que soma',
      valor: 500,
      tipo: 'saida',
      categoria: 'fluxo_realizado',
      origem: 'fluxo',
      tipoOriginal: 'despesa inversa',
      tipoRegistro: 'realizado',
      editadoManualmente: false,
      school_id: schoolId
    };

    const impact = getLedgerSaldoImpact(entry, classifications);
    expect(impact).toBe(500);

    const totals = processLedger([entry], classifications);
    // Como o sinal é somar, entra no resultado como receita (aumenta resultado)
    expect(totals.receitas).toBe(500);
    expect(totals.despesas).toBe(0);
    expect(totals.resultado).toBe(500);
    expect(totals.saldoMovimento).toBe(500);
  });

  it('deve validar Transferência entrando no resultado', () => {
    // Cenário: Transferência configurada para entrar no resultado
    const classifications: TypeClassification[] = [
      {
        id: '3',
        school_id: schoolId,
        tipoValor: 'transferencia',
        classificacao: 'receita',
        entraNoResultado: true,
        impactaCaixa: true,
        operacaoSinal: 'somar',
        label: 'Transferência'
      } as any
    ];

    const rule = resolveLedgerRule('transferencia', classifications);
    expect(rule.entraNoResultado).toBe(true);
    expect(rule.impactaCaixa).toBe(true);
    expect(rule.operacaoSinal).toBe('somar');

    const entry: FinancialEntry = {
      id: 'e3',
      data: '2026-05-01',
      descricao: 'Transferência de saldo',
      valor: 2000,
      tipo: 'entrada',
      categoria: 'fluxo_realizado',
      origem: 'fluxo',
      tipoOriginal: 'transferencia',
      tipoRegistro: 'realizado',
      editadoManualmente: false,
      school_id: schoolId
    };

    const impact = getLedgerSaldoImpact(entry, classifications);
    expect(impact).toBe(2000);

    const totals = processLedger([entry], classifications);
    expect(totals.receitas).toBe(2000);
    expect(totals.resultado).toBe(2000);
    expect(totals.saldoMovimento).toBe(2000);
  });

  it('deve validar tipos customizados por empresa', () => {
    // Cenário: Empresa A configura um tipo como ignorar, Empresa B configura o mesmo tipo como receita
    const classificationsA: TypeClassification[] = [
      {
        id: 'a',
        school_id: 'empresa-a',
        tipoValor: 'custom-type',
        classificacao: 'ignorar',
        entraNoResultado: false,
        impactaCaixa: false,
        operacaoSinal: 'somar',
        label: 'Customizado Ignorar'
      } as any
    ];

    const classificationsB: TypeClassification[] = [
      {
        id: 'b',
        school_id: 'empresa-b',
        tipoValor: 'custom-type',
        classificacao: 'receita',
        entraNoResultado: true,
        impactaCaixa: true,
        operacaoSinal: 'somar',
        label: 'Customizado Receita'
      } as any
    ];

    const entryA: FinancialEntry = {
      id: 'ea',
      data: '2026-05-01',
      descricao: 'Teste A',
      valor: 1500,
      tipo: 'entrada',
      categoria: 'fluxo_realizado',
      origem: 'fluxo',
      tipoOriginal: 'custom-type',
      tipoRegistro: 'realizado',
      editadoManualmente: false,
      school_id: 'empresa-a'
    };

    const entryB: FinancialEntry = {
      id: 'eb',
      data: '2026-05-01',
      descricao: 'Teste B',
      valor: 1500,
      tipo: 'entrada',
      categoria: 'fluxo_realizado',
      origem: 'fluxo',
      tipoOriginal: 'custom-type',
      tipoRegistro: 'realizado',
      editadoManualmente: false,
      school_id: 'empresa-b'
    };

    // Para Empresa A, ignora e o impacto no saldo é 0
    expect(getLedgerSaldoImpact(entryA, classificationsA)).toBe(0);
    const totalsA = processLedger([entryA], classificationsA);
    expect(totalsA.receitas).toBe(0);
    expect(totalsA.resultado).toBe(0);

    // Para Empresa B, computa e o impacto é 1500
    expect(getLedgerSaldoImpact(entryB, classificationsB)).toBe(1500);
    const totalsB = processLedger([entryB], classificationsB);
    expect(totalsB.receitas).toBe(1500);
    expect(totalsB.resultado).toBe(1500);
  });
});

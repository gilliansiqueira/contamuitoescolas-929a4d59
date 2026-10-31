import { describe, it, expect } from 'vitest';
import { agregarRealizado, classifyGestao, pontoEquilibrio, retornoMarketing, margem, mediaUltimos } from '@/lib/gestaoIndicadores';

describe('gestaoIndicadores', () => {
  it('classifica grupos', () => {
    expect(classifyGestao('Pro-Labore', 'x')).toBe('Pessoal');
    expect(classifyGestao('Marketing', 'Anúncio Meta')).toBe('Marketing');
    expect(classifyGestao('Escritório', 'Aluguel')).toBe('Administrativo');
    expect(classifyGestao('Guias Locais', 'Peru')).toBe('Operacional');
  });
  it('calcula ponto de equilíbrio e retorno', () => {
    const map = agregarRealizado([
      { data: '2026-08-01', tipo: 'receita', valor: 1000, conta_nome: 'Receita Passeios', descricao: '' },
      { data: '2026-08-02', tipo: 'despesa', valor: 400, conta_nome: 'Guias Locais', descricao: '' },
      { data: '2026-08-03', tipo: 'despesa', valor: 300, conta_nome: 'Pro-Labore', descricao: '' },
      { data: '2026-08-03', tipo: 'despesa', valor: 100, conta_nome: 'Marketing', descricao: 'Anúncio' },
    ]);
    const m = map.get('2026-08')!;
    expect(pontoEquilibrio(m)).toBeCloseTo(400 / 0.6);
    expect(retornoMarketing(m)).toBe(10);
    expect(margem(m.receita, m.despesa)).toBe(20);
  });
  it('média dos últimos meses', () => {
    const m = new Map([['2026-06', 10], ['2026-07', 20], ['2026-08', 30], ['2026-09', 90]]);
    expect(mediaUltimos(m, '2026-08')).toBe(20);
  });
});

import { excluiSocios } from '@/lib/gestaoIndicadores';
describe('excluiSocios', () => {
  it('identifica pagamentos aos sócios', () => {
    expect(excluiSocios('Pro-Labore', 'Luiz')).toBe(true);
    expect(excluiSocios('Administrativo', 'Distribuição de lucro março')).toBe(true);
    expect(excluiSocios('Pessoal', 'Bônus Dennis')).toBe(true);
    expect(excluiSocios('Deslocamento', 'Retirada de materiais')).toBe(false);
  });
});

import { recebimentosPorForma } from '@/lib/gestaoIndicadores';
describe('recebimentosPorForma', () => {
  it('calcula % por forma e inclui não informada', () => {
    const r = recebimentosPorForma([{ valor: 30, payment_method_key: 'pix' }, { valor: 10, payment_method_key: 'pix' }, { valor: 60 }]);
    expect(r[0]).toMatchObject({ forma: 'Forma não informada', pct: 60 });
    expect(r[1]).toMatchObject({ forma: 'PIX', pct: 40, qtd: 2 });
  });
});

import { nomeForma } from '@/lib/gestaoIndicadores';
describe('nomeForma', () => {
  it('traduz códigos da Quintal', () => {
    expect(nomeForma('685489087')).toBe('Cartão de crédito');
    expect(nomeForma('685489090')).toBe('Boleto');
    expect(nomeForma('685489098')).toBe('Pix');
  });
});

import { dividirPorCnpj } from '@/lib/gestaoIndicadores';
describe('dividirPorCnpj', () => {
  it('soma dos CNPJs bate com o total', () => {
    const r = dividirPorCnpj({ receita: 1000, despesa: 900 }, new Map([['a', 300], ['b', 100]]))!;
    expect(r.get('a')!.receita + r.get('b')!.receita).toBe(1000);
    expect(r.get('a')!.despesa + r.get('b')!.despesa).toBeCloseTo(900);
    expect(r.get('a')!.receita).toBe(750);
    expect(dividirPorCnpj({ receita: 1, despesa: 1 }, new Map())).toBeNull();
  });
});

import { agregarGestaoCompetencia, dividirPorCnpjDireto, pontoEquilibrio as pe2 } from '@/lib/gestaoIndicadores';
describe('competência e CNPJ direto', () => {
  it('ponto de equilíbrio usa custo do centro, não pagamentos antecipados', () => {
    const m = agregarGestaoCompetencia(
      [{ data: '2026-03-10', tipo: 'despesa', valor: 500000, conta_nome: 'Hospedagem', descricao: '' },
       { data: '2026-03-10', tipo: 'despesa', valor: 20000, conta_nome: 'Pro-Labore', descricao: '' }],
      [{ data: '2026-03-05', tipo: 'receita', valor: 200000 }, { data: '2026-03-05', tipo: 'despesa', valor: 150000 }]).get('2026-03')!;
    expect(m.operacional).toBe(150000);
    expect(pe2(m)).toBeCloseTo(80000);
  });
  it('CNPJs com margens próprias somam o total', () => {
    const d = dividirPorCnpjDireto({ receita: 100, despesa: 90 }, new Map([['a', { receita: 80, custo: 70 }], ['b', { receita: 20, custo: 0 }]]))!;
    expect(d.get('a')!.despesa + d.get('b')!.despesa).toBeCloseTo(90);
    expect(d.get('a')!.despesa).toBeCloseTo(86);
    expect(d.get('b')!.despesa).toBeCloseTo(4);
  });
});
describe('formas estimadas', () => {
  it('nomeia Asaas e cartão estimado', () => {
    expect(nomeForma('asaas')).toBe('Asaas (boleto/Pix)');
    expect(nomeForma('cartao_estimado')).toBe('Cartão de crédito (estimado)');
  });
});
import { margemPeriodo } from '@/lib/gestaoIndicadores';
describe('margemPeriodo', () => {
  it('Peru jan–set soma o período (~21,0%)', () => {
    const m = new Map([['2026-02', { r: 67815, d: 61369 }], ['2026-04', { r: 132354, d: 107895 }], ['2026-05', { r: 116358, d: 92278 }], ['2026-08', { r: 131980, d: 99229 }], ['2026-09', { r: 164170, d: 123501 }]]);
    const months = Array.from({ length: 9 }, (_, i) => `2026-0${i + 1}`);
    expect(margemPeriodo(m, months)! ).toBeCloseTo(20.96, 1);
  });
});

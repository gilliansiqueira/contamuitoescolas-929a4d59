import { describe, it, expect } from 'vitest';
import { parseDescricao } from '@/lib/descricaoParser';

describe('parseDescricao', () => {
  it('guias com fornecedor', () => {
    const r = parseDescricao('Expedição Peru (12 a 20/09/2026) - Guias Locais (USD 14,008.50 x VET 5,2982) - Inclui adicionais grupo agosto - Peru Top Destination', 'Peru');
    expect(r.tipo).toBe('Guias locais');
    expect(r.fornecedor).toBe('Peru Top Destination');
  });
  it('total da atividade', () => {
    const r = parseDescricao('Expedição Peru - Hospedagem (total da atividade)', 'Peru');
    expect(r).toMatchObject({ tipo: 'Hospedagem', fornecedor: null });
  });
  it('não inventa o nome do guia em totais agregados', () => {
    expect(parseDescricao('Expedição Peru - Guias locais (total da atividade)', 'Peru'))
      .toEqual({ tipo: 'Guias locais', fornecedor: null, detalhe: '' });
  });
  it('preserva informações adicionais sem repetir o fornecedor', () => {
    const r = parseDescricao('Expedição Peru (12 a 20/09/2026) - Guias Locais (USD 14,008.50 x VET 5,2982) - Inclui adicionais grupo agosto - Peru Top Destination', 'Peru');
    expect(r.detalhe).toBe('USD 14,008.50 x VET 5,2982 · Inclui adicionais grupo agosto');
    expect(r.fornecedor).toBe('Peru Top Destination');
  });
  it('taxa asaas', () => {
    const r = parseDescricao('Expedição Peru (12 a 20/09/2026) - Taxa Asaas (Ana Maria) - Parcela (6/12) - Asaas', 'Peru');
    expect(r).toMatchObject({ tipo: 'Taxas de pagamento', fornecedor: 'Asaas' });
  });
  it('guia qdc com pessoa', () => {
    const r = parseDescricao('Expedição Peru (12 a 20/09/2026) - Guia QdC - Nelson da Silva Junior', 'Peru');
    expect(r).toMatchObject({ tipo: 'Guia QdC', fornecedor: 'Nelson da Silva Junior' });
  });
  it('atacama', () => {
    const r = parseDescricao('Atacama e Salar de Uyuni (05 a 13/09/2026) - Seguro Viagem [Tiny 123]', 'Atacama');
    expect(r).toMatchObject({ tipo: 'Seguro', fornecedor: null });
  });
});

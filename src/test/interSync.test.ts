import { describe, it, expect } from 'vitest';
import { mapInterTx, splitNew, syncWindow } from '../../supabase/functions/inter-sync/mapping';

describe('Integração Banco Inter', () => {
  it('usa C/D do banco para o sentido, não o sinal do valor', () => {
    expect(mapInterTx({ idTransacao: '1', dataEntrada: '2026-11-05', tipoOperacao: 'D', valor: '150.25', titulo: 'Pix enviado', descricao: 'Fulano' }))
      .toEqual({ data: '2026-11-05', tipo: 'saida', valor: 150.25, descricao: 'Pix enviado - Fulano', bankRef: 'inter:1' });
    expect(mapInterTx({ idTransacao: '2', dataEntrada: '2026-11-05', tipoOperacao: 'C', valor: '-80' })?.tipo).toBe('entrada');
    expect(mapInterTx({ idTransacao: '3', dataEntrada: '2026-11-05', valor: '10' })).toBeNull();
  });

  it('não duplica com OFX já importado nem com sincronização anterior', () => {
    const m = [
      mapInterTx({ idTransacao: 'a', dataEntrada: '2026-11-05', tipoOperacao: 'D', valor: '100', titulo: 'x' })!,
      mapInterTx({ idTransacao: 'b', dataEntrada: '2026-11-05', tipoOperacao: 'D', valor: '100', titulo: 'y' })!,
      mapInterTx({ idTransacao: 'c', dataEntrada: '2026-11-06', tipoOperacao: 'C', valor: '50', titulo: 'z' })!,
    ];
    const r = splitNew(m, [
      { data: '2026-11-05', tipo: 'saida', valor: 100, bank_ref: null }, // veio do OFX
      { data: '2026-11-06', tipo: 'entrada', valor: 50, bank_ref: 'inter:c' }, // sincronização anterior
    ]);
    expect(r.jaExistiam).toBe(2);
    expect(r.novos.map(n => n.bankRef)).toEqual(['inter:b']);
  });

  it('janela respeita a data de início', () => {
    expect(syncWindow('2026-11-08', '2026-11-01', 'noturna')).toEqual({ inicio: '2026-11-02', fim: '2026-11-08' });
    expect(syncWindow('2026-11-08', '2026-11-01', 'comercial')).toEqual({ inicio: '2026-11-07', fim: '2026-11-08' });
    expect(syncWindow('2026-11-03', '2026-11-01', 'noturna').inicio).toBe('2026-11-01');
  });
});

describe('Inter: leitura fecha buracos entre extratos', () => {
  it('OFX até 30/10 e primeira leitura 02/11–08/11: relê a partir de 31/10', async () => {
    const { gapStart } = await import('../../supabase/functions/inter-sync/mapping');
    const last = gapStart('2026-10-30', '2026-11-02', '2026-11-06');
    expect(last).toBe('2026-10-30');
    expect(syncWindow('2026-11-08', '2026-10-01', 'comercial', last)).toEqual({ inicio: '2026-10-31', fim: '2026-11-08' });
  });
  it('depois que o buraco foi lido, volta à janela normal', async () => {
    const { gapStart } = await import('../../supabase/functions/inter-sync/mapping');
    const last = gapStart('2026-10-30', '2026-10-31', '2026-11-06');
    expect(syncWindow('2026-11-08', '2026-10-01', 'comercial', last).inicio).toBe('2026-11-07');
  });
  it('nunca antes da data de início nem mais de 90 dias', () => {
    expect(syncWindow('2026-11-08', '2026-11-01', 'noturna', '2026-10-20').inicio).toBe('2026-11-01');
    expect(syncWindow('2026-11-08', '2025-01-01', 'noturna', '2026-01-01').inicio).toBe('2026-08-11');
  });
});

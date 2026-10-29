import { describe, it, expect } from 'vitest';
import { financeiroSemTurma } from '@/lib/renewal/exportXlsx';
describe('financeiro sem turma', () => {
  it('inclui aviso resolvido e exclui aluno já nas linhas', () => {
    const rows: any[] = [{ imported: { matricula: '209', aluno: 'Daiana' } }];
    const out = financeiroSemTurma([
      { kind: 'sem_correspondencia', resolved: true, detail: { sacado: 'Miguel Albanio Andrade', mat: '198', pending: 2 } },
      { kind: 'sem_correspondencia', detail: { sacado: 'Daiana', mat: '209', pending: 6 } },
    ] as any, rows);
    expect(out).toEqual([{ aluno: 'Miguel Albanio Andrade', matricula: '198', parcelas: 2 }]);
  });
});

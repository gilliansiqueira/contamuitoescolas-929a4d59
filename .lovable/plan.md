# Corrigir datas quebradas na planilha de Santa Mônica

## O que está errado
Nas linhas 24 (Julia Kaprowski) e 25 (Juliana Ferreira da Rocha) da aba "Turmas Existentes", as datas estão salvas como números soltos, sem formato de data. O vencimento da última parcela ainda aparece como porcentagem. Esse problema já vinha da planilha original.
- Término do contrato: 46379, que corresponde a 24/12/2026
- Venc. última parcela: 46397, que corresponde a 11/01/2027

## O que vou fazer
- Gravar essas células como datas reais, no formato dd/mm/aaaa, igual às outras linhas.
- Procurar o mesmo problema em todas as colunas de data das três abas (Turmas Existentes, Personal e VIP) e corrigir tudo o que aparecer, não só essas duas linhas.
- Não mexer em nenhum outro valor, nas fórmulas nem no visual.
- Salvar como `Renovacao_1.2027_SM_v3.xlsx`, recalcular as fórmulas e confirmar que não ficou nenhum erro.
- Fazer a mesma checagem rápida na planilha de Ingleses e criar uma v3 só se aparecer o mesmo problema.

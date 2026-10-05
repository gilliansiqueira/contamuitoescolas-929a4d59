# Pinheirinho: diferença de R$ 775,59 na Caixa

## Causa (confirmada nos dados)
- A planilha foi importada certinha: 6 lançamentos, saldo final R$ 352,02.
- O problema está no cadastro da conta Caixa: o **saldo inicial R$ 1.127,61 está com data 30/09/2026**. O certo é **08/09/2026** (fim do dia anterior ao primeiro lançamento, 09/09).
- Com a data 30/09, o sistema entende que R$ 1.127,61 já é o saldo depois de todos os lançamentos de setembro. Por isso a coluna Saldo fica parada em R$ 1.127,61 em todas as linhas e a diferença com o banco (R$ 352,02) é exatamente R$ 775,59 = 251,45 + 340,34 + 75,00 + 108,80. Os R$ 10.259,71 se anulam (entram e saem).

## O que será feito
1. Corrigir a data do saldo inicial da Caixa da Pinheirinho para 08/09/2026. Nenhum lançamento muda.
2. Conferir que a coluna Saldo passa a cair até R$ 352,02 em 30/09 e o aviso de diferença some.
3. Evitar que aconteça de novo, para todas as empresas: ao importar um extrato, se a data do saldo inicial da conta for igual ou depois do primeiro lançamento do arquivo e o saldo anterior do arquivo bater com o saldo inicial, mostrar aviso "A data do saldo inicial parece errada — deveria ser DD/MM" com botão para ajustar.

## Detalhes técnicos
- `bank_accounts.saldo_inicial_data` da conta `f85ca999-…` → `2026-09-08` (update de dado).
- Aviso em `BankAccountsImports.tsx` no fluxo de importação (perto da linha 200, onde já usa `saldo_inicial_data`).

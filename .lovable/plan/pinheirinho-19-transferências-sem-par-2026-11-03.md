# Pinheirinho — 19 transferências sem par

## O que encontrei
- **18 das 19** são saídas da Stone de **julho e agosto/2026** (09/07 a 31/08). O extrato da Stone começa em 09/07, mas o do Sicredi só começa em 01/09 — a outra ponta (entrada no Sicredi) não existe na plataforma. O Fluxo Bancário de Pinheirinho começa em setembro/2026, então esses meses nem entram nos cálculos; só aparecem no aviso.
- **A 19ª é o par de R$ 6.670,85**: saída da Stone no sábado 10/10 e entrada no Sicredi na segunda 13/10. O pareamento automático aceita no máximo 2 dias de diferença; aqui são 3 (fim de semana), por isso não casou.

## O que vou fazer
1. **Regra de pareamento:** contar a janela em dias úteis (até 2 dias úteis, pulando sábado e domingo), mantendo a preferência pela data mais próxima. Assim saídas de sexta/sábado casam com a entrada da segunda.
2. **Aviso "Transferências sem par":** contar só linhas a partir do mês de início do Fluxo Bancário da empresa (setembro em Pinheirinho), ignorando meses antes do início — onde a outra conta nem tem extrato.
3. **Corrigir Pinheirinho agora:** parear as duas linhas de R$ 6.670,85 (10/10 Stone → 13/10 Sicredi). O aviso deve cair de 19 para 0.
4. Teste automático com o caso de sábado → segunda e com uma linha anterior ao início que não deve contar.

## Detalhes técnicos
- `findTransferCounterpart` e o pareamento de sugestões em `src/lib/bankStatements/bankCashflowEngine.ts`: trocar `dDiff <= 2` por diferença em dias úteis ≤ 2 (score continua pela distância em dias corridos).
- `BankTransactionsTable.tsx` (`transferPending`): filtrar `data >= start_month` da fonte de dados.
- Rodar `autoPairTransfers` para Pinheirinho após a mudança (ou atualização direta com registro no histórico de alterações).
- Os OFX enviados (Sicredi e Stone de outubro) já estão na plataforma; nada a importar.

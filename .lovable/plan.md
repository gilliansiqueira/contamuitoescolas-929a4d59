# São Braz: a diferença no movimento e uma prévia de ativação mais clara

## O que causa a diferença (confirmado nos dados)
A diferença de **R$ 3.538,38** são **6 recebimentos (Receita) de 01/10/2026**.

- A coluna **Banco** conta tudo até o último extrato, que vai até **01/10**.
- A coluna **Dashboard / Fluxo Diário** mostra só o mês de **setembro**, então esses 6 recebimentos de outubro ficam de fora.

Conta de setembro:

| | Setembro | Banco até 01/10 |
|---|---|---|
| Receitas | 190.780,90 | 194.319,28 (+3.538,38 de 01/10) |
| Despesas | 200.144,87 | 200.144,87 |
| Ignorado (R$ 118 entrou e saiu) | 0 | 0 |

Ou seja, nenhum lançamento está faltando, duplicado ou mal classificado. É só uma diferença de data de corte, e a equipe não tem o que corrigir. Mesmo assim, o botão continua travado.

## O que muda
1. **Mesmo período nas duas colunas.** O mês de setembro passa a ser comparado com o banco até 30/09. Os lançamentos de 01/10 em diante aparecem numa linha separada, "Movimento de outubro já no extrato (entra no próximo mês)", com quantidade e valor. Eles não contam como diferença.
2. **Saldo final.** O saldo de 30/09 é comparado com o saldo do banco em 30/09. O saldo de 01/10 fica só como informação.
3. **Lista "O que falta para liberar o botão".** Quando houver diferença real, a prévia diz em palavras simples o que fazer. Por exemplo:
   - "X movimentações a classificar"
   - "Conta Y sem extrato até 30/09"
   - "Diferença de R$ Z: lançamentos que entraram no banco e não no Dashboard", com a lista das linhas
4. **Diferença por tipo.** Se o movimento não bater, a prévia mostra de onde vem: receitas, despesas, operações ou ignorados. Assim fica claro onde a diferença está.

Depois da mudança, São Braz deve mostrar movimento e saldo final batendo, e o botão deve liberar. Vou conferir isso na tela.

## Detalhes técnicos
- `ActivationPreview.tsx`: `genIn`/`genOut`/`ign` filtram até `min(bankTo, fim do mês)`. O saldo do banco no fim do mês vem da âncora ou é calculado como `bankFim − movimento posterior`. `fimReal` é comparado com esse valor.
- Novo bloco com os lançamentos de `gen` posteriores ao fim do mês, apenas para informação.
- A lista de pendências é derivada das condições que já existem (`movOk`, `iniDiff`, `fimDiff`, `aClass`, `holder`). Nas diferenças, as linhas de `gen` são agrupadas por `tipo_nome` e comparadas com os totais de `buildMonthMovement`.
- Os cálculos continuam no motor oficial. Só a janela de comparação e a explicação mudam. Sem alteração no banco de dados.

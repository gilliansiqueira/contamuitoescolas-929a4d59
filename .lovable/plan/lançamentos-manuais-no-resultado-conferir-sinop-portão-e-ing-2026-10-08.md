# Lançamentos manuais no Resultado: conferir Sinop, Portão e Ingleses

## Regra combinada
- Lançamento manual com "Não altera o saldo bancário" **entra no Resultado**, seja Receita, Despesa ou outra categoria do modelo.
- **Só Distribuição de lucros fica fora do Resultado.** Ela também não mexe no saldo quando está marcada.

## O que já está gravado

**Floripa Ingleses** (lançado hoje, todos como Receita e marcados "não altera o saldo")
- Agosto: Receita Antecipada R$ 17.171,86 + R$ 19.455,10
- Setembro: Receita Antecipada R$ 3.747,56 + R$ 13.856,51, mais **"Despesa Antecipada" R$ 12.573,00 lançada como Receita (entrada)**
- Outubro: Receita Antecipada R$ 22.453,30
- Novembro: R$ 7.372,03 (previsão)

**Sinop**
- Setembro: Receita R$ 37.168,82
- Setembro: DL R$ 30.000,00, como Distribuição de lucros

**Portão**
- Setembro: 3 cheques como Receita, total R$ 20.535,76
- Setembro: 3 saídas iguais como Distribuição de lucros

As três empresas usam o Fluxo Bancário desde setembro. Agosto é calculado pelo Histórico Financeiro, onde os valores manuais também foram somados.

## O que vou fazer
1. **Achar a causa.** Abrir o Dashboard de agosto, setembro e outubro nas três empresas, como a equipe vê, e comparar a Receita e o Resultado com o esperado:
   - **Ingleses:** setembro com +R$ 30.177,07 de receita manual
   - **Sinop:** setembro com +R$ 37.168,82
   - **Portão:** setembro com +R$ 20.535,76

   O motor de cálculo já devia contar esses valores. Por isso preciso ver em qual tela ou etapa eles somem. Hoje há três suspeitas:
   - o cartão de Resultado realizado
   - o corte do mês parcial
   - o filtro do modelo financeiro
2. **Corrigir no motor oficial**, para que receitas e despesas manuais entrem no Resultado sem mexer no saldo, e testar com os casos reais das três empresas.
3. **Mostrar o antes e depois** da Receita, do Resultado e do Saldo de cada mês, por empresa.
4. **Ingleses, "Despesa Antecipada" de R$ 12.573,00:** hoje ela soma como receita. Se for uma despesa, troco a categoria para despesa só depois da sua confirmação.

## Detalhes técnicos
- Conferência via Playwright no Dashboard, com sessão de admin, nas três empresas. Cruzar com `buildMonthMovement` (`receitasRealizadas` e `receitas`) para os mesmos meses.
- Pontos a verificar:
  - o gate do modelo em `projectEntries` (`isInModel` com categoria "Receita")
  - `includeEntryForMonth` com `fonte='fluxo'`
  - o espelho em `historical_monthly` nos meses de histórico (risco de somar duas vezes)
  - os cartões do Dashboard que leem os totais
- Teste novo em `src/test/ledgerEngine.test.ts` e `periodMovement.test.ts`: manual com `afetaSaldo=false` entra em receitas e despesas sem alterar `saldoMovimento`; Distribuição de lucros fica fora das duas coisas.
- Nenhum cálculo novo fora de `ledgerEngine`/`periodMovement`.

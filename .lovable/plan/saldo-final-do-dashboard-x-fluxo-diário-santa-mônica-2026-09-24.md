# Saldo final do Dashboard x Fluxo Diário (Santa Mônica)

## Resposta curta
Não, os R$ 19.171,52 não são o projetado. O Dashboard mostra dois saldos finais:
- **Número grande (realizado):** R$ 19.171,52. O certo seria **R$ 16.171,52**, que é o saldo do banco em 24/09. Está **R$ 3.000,00 acima**.
- **Dica "Projetado" abaixo dele:** deve mostrar os mesmos R$ 18.223,78 do Fluxo Diário, e esse número está certo.

## Causa (confirmada pelos números)
O sistema calcula dois saldos de início de setembro:
- **"Projetado":** usado no Fluxo Diário. Começa em R$ 28.175,97, igual ao banco.
- **"Realizado":** usado no número grande do Dashboard. Soma só o que foi realizado nos meses anteriores e fica R$ 3.000,00 acima.

A diferença já existia no histórico antigo: entre junho e agosto há previsões que nunca viraram realizado, por exemplo várias "Pagar - Salário Professores" de R$ 3.000. O ajuste para o saldo do banco foi calculado sobre o "projetado", então só ele ficou certo. Nenhum dado está errado ou duplicado; o que muda é o ponto de partida de cada cálculo.

## O que vou fazer
1. **Um único ponto de partida:** quando a empresa estiver no Fluxo de Caixa, setembro começa com o saldo do banco em 31/08, tanto no "realizado" quanto no "projetado". Assim, Dashboard, Fluxo Diário e prévia partem do mesmo número.
2. **Sem ajuste artificial:** o lançamento de ajuste em 31/08 deixa de existir. Agosto e os meses anteriores continuam exatamente como estão hoje.
3. **Localizar os R$ 3.000:** mostrar na prévia quais previsões antigas causam a diferença entre os dois cálculos antigos, só como informação.
4. **Conferir:** Dashboard com R$ 16.171,52 no realizado e R$ 18.223,78 no projetado, Fluxo Diário com R$ 18.223,78, prévia batendo com o banco. As outras empresas não mudam.

## Detalhes técnicos
- `school_data_sources`: nova coluna `opening_balance` (saldo do banco no dia anterior a `start_month`), gravada na ativação. `opening_adjustment` deixa de ser usada.
- `periodMovement.ts`: novo campo opcional `cashflowAnchor { month, saldo }` no contexto. Com ele, `computeSaldoFinal`, `computeSaldoFinalRealizado` e os `computeSaldoInicial*` partem de `saldo` para meses ≥ `month`. Os meses anteriores seguem a lógica atual.
- `usePeriodMovementCtx` e `Dashboard` / `DailyFlowTable` recebem a âncora quando o status é `ativo`. O overlay para de criar a linha `bcf-ajuste-saldo-inicial`.
- `ActivationPreview`: usa a mesma âncora e lista as previsões pré-setembro que explicam a diferença entre os dois cálculos antigos.

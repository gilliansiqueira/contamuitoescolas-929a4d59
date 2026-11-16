# Indaiatuba: receita integral para corrigir a lucratividade operacional

## O que encontrei
Indaiatuba não tem nenhum valor de receita integral cadastrado em nenhum mês. Sem esse valor, a lucratividade usa só a receita que entrou no caixa e fica muito negativa.

## O que vou fazer
1. Você me manda a lista com a receita integral de cada mês de 2026 (mês e valor).
2. Eu gravo esses valores no campo de receita integral de Indaiatuba, o mesmo que a equipe preenche na tela.
3. A lucratividade é recalculada sozinha, de outubro/2026 até o mês anterior ao atual. Meses já fechados não mudam; se algum precisar mudar, eu aviso antes.
4. Confiro no Dashboard que a lucratividade operacional ficou coerente com a do ano passado e te mando o resultado mês a mês.

Nada muda em receitas, despesas ou saldo. Só o indicador de lucratividade passa a usar a receita integral.

## Detalhes técnicos
- Gravar em `monthly_integral_revenue` (school_id de Indaiatuba, month `YYYY-MM`, valor).
- `useAutoProfitability` regrava `kpi_values` das `auto_key`; meses anteriores a outubro/2026 ficam como estão.

# Blumenau — incluir Lucratividade total

## O que encontrei
- Blumenau tem só um indicador de lucratividade: **Lucratividade operacional** (automática), que já tem outubro/2026 = **-22,56%**.
- Não existe o indicador **Lucratividade total**, por isso parece que "não tem lucratividade".

## O que vou fazer
1. Criar em Blumenau o indicador **Lucratividade total**, no mesmo grupo e formato do operacional, ligado à regra automática (mesma das outras escolas: inclui Operações, desconta aplicações/resgates).
2. Calcular outubro/2026 pelo mesmo motor do Dashboard e gravar o valor (o cálculo automático também preenche sozinho ao abrir o Dashboard).
3. Conferir que o valor gravado bate com o Dashboard e te informar os dois números de outubro.

Meses anteriores não serão preenchidos, salvo se você pedir.

## Detalhes técnicos
- Inserir `kpi_definitions` copiando colunas do registro `fe58d41a-…` com `name='Lucratividade total'`, `auto_key='lucro_total'`.
- Valor de 2026-10 em `kpi_values` calculado via `profitability.ts` sobre `buildMonthMovement`.

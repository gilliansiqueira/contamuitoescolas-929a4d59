# Ponto: corrigir faltas, mostrar extras no Dia e ignorar o dia em andamento

## O que está errado (conferido nos dados)
- O relatório do PontoFopag traz dois tipos de "falta":
  - **Falta do dia inteiro:** ocorrência "Falta" e nenhuma batida (ex.: Tamires hoje).
  - **Minutos faltando:** "Faltas 00:38 (relatório)", quando a pessoa trabalhou mas ficou abaixo da jornada (Bruno em 02/10 trabalhou 08:10).
- A aba "Extras e faltas" tratava os dois como falta do dia inteiro e somava a jornada toda (08:48). Por isso o Bruno apareceu com 1 falta e 08:48 sem trabalhar.
- Hoje (05/10) o relatório foi baixado às 10:44. Quem ainda não tinha batido ponto foi marcado como "Falta", mesmo começando mais tarde (Geovanna, por exemplo, entra por volta das 12h).

## Correções
1. **Faltas separadas em duas colunas:**
   - **Faltas (dias):** só dia sem nenhuma batida.
   - **Atrasos/saídas antes (horas):** soma dos "Faltas HH:MM" do relatório. O Bruno passa a mostrar 0 dias e 00:38.
   - **Horas não trabalhadas** = jornada dos dias sem batida + esses minutos.
   - Clicando no nome aparecem os dias, cada um com o tipo de falta.
2. **Dia em andamento (data de hoje):** só conta como falta se a pessoa não bateu nenhum ponto e o horário de entrada previsto já tinha passado quando o relatório foi baixado. A Tamires conta; quem entra mais tarde não conta. Os minutos faltando e as horas extras de hoje não entram nos totais até o dia fechar.
3. **As telas passam a usar a mesma conta:**
   - **Dia:** nova coluna **Extras** (ex.: 00:26). Na coluna Ocorrência, "Faltas 00:38" aparece como **"Faltou 00:38"**, em vez de "Aguardando informação".
   - **Resumo do mês:** "Faltas" conta só dias sem batida, como na aba "Extras e faltas", e ganha a coluna de horas faltando.
   - Os cartões do Dia usam a mesma regra.

## Detalhes técnicos
- `TeamTimePanel.tsx`: helper único `classifyDay(d, emp, today)` retorna `{ faltaDia, faltaMin, extraMin, emAndamento }`, usado pelas três abas.
- `faltaMin` é lido de `/Faltas (\d+:\d{2})/` na ocorrência. `faltaDia` vale quando não há batidas e (o dia não é hoje, ou a hora de `synced_at` já passou do primeiro horário de `horario_previsto`).
- Situação exibida: "aguardando" com `faltaMin` vira o selo "Faltou HH:MM"; "aguardando" com dia sem batida vira "Falta". Nada é gravado de novo no banco e não há migração.

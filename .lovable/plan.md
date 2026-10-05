# Ponto da Equipe — mostrar batidas completas na visão do dia

## O que muda

Na tabela do dia (Ponto da Equipe → aba "Dia"):

- **Remover** as colunas **Matrícula** e **Previsto**.
- **Adicionar** a coluna **Batidas**, com todos os horários batidos no dia em ordem (ex.: `08:13 · 13:35 · 17:32`).
- Quando faltar batida (menos batidas que os horários da jornada, ex.: jornada `08:00 13:00 14:00 17:48` com 3 batidas), o slot que falta aparece como chip tracejado em vermelho com o horário previsto ali dentro (ex.: `14:00`), usando o pareamento do início e do fim da sequência (o último horário batido casa com a última saída prevista — cobre o caso clássico de faltar a saída do almoço).
- Os demais colunas continuam: Nome, 1ª marcação, Última, Trabalhadas, Banco de horas, Ocorrência, Situação, Atualizado.
- A busca passa a indicar só "Colaboradora" (a matrícula deixa de aparecer na tabela, mas a busca por matrícula continua funcionando por trás).

Nenhuma migração nem dado novo: os horários completos já estão gravados em `team_time_daily.marcacoes` e hoje chegam ao frontend sem uso.

## Como (detalhe técnico)

- `src/hooks/useTeamTime.ts`: adicionar `marcacoes?: string[]` à interface `TeamDaily` (o `select('*')` já traz a coluna). Atualizar `buildSampleData` para gerar `marcacoes` de exemplo coerentes com cada situação.
- `src/components/team/TeamTimePanel.tsx` (tabela do dia):
  - Cabeçalho: tirar `Matrícula` e `Previsto`, incluir `Batidas`.
  - Renderizar as batidas como chips pequenos; slot faltante = chip tracejado destrutivo com o horário previsto correspondente (posicional: primeiras batidas casam com os primeiros horários da jornada, última batida casa com o último horário).
  - Coluna "Atualizado" mantida (não foi pedida remoção).
- Sem alteração na Edge Function, RLS nem banco.

## Verificação

- Playwright na tela do Ponto: conferir colunas novas, chips de batidas reais (ex. colaboradora com 3 batidas mostra o slot faltante) e o filtro por nome.
- Compilar sem erros.

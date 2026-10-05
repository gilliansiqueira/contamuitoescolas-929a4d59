# Ponto da Equipe: Horas extras e Faltas (dia e mês)

## O que muda
Nova aba **"Extras e faltas"** ao lado de "Dia" e "Resumo do mês", com dois quadros lado a lado:

**Horas extras**
- Cartões no topo: horas extras do dia escolhido (total da equipe) e do mês (total da equipe).
- Tabela por colaboradora: Horas extras no dia · Horas extras no mês (soma em horas, ex.: 12:35) · Dias com extra no mês.
- Clicar na pessoa abre a lista dos dias do mês com extra (data, batidas, horas extras).

**Faltas**
- Cartões: faltas do dia (quantas pessoas) e faltas do mês (total de dias).
- Tabela por colaboradora: Faltou hoje (sim/não) · Faltas no mês (dias) · Horas não trabalhadas.
- Clicar abre os dias de falta (data e ocorrência impressa pelo PontoFopag).

Também no "Resumo do mês": a coluna "Horas extras (dias)" passa a mostrar também o total em horas.

## Regras
- Usa só o que já vem do relatório do PontoFopag (horas extras e situação "Falta"); nada é recalculado por conta própria.
- Dia "Em andamento" não conta como falta. Funcionárias ocultas ficam fora.
- Somente leitura; mesmo acesso de hoje (super admin e quem tem permissão do Ponto).

## Detalhes técnicos
- `TeamTimePanel.tsx`: nova `TabsTrigger value="extras"`; helper `hhmmToMin`/`minToHhmm` para somar `team_time_daily.horas_extras`.
- Falta = `situacao === 'falta'` ou ocorrência de origem do relatório com tipo falta; horas não trabalhadas = `horario_previsto` do dia quando falta.
- Sem migração; dados já carregados por `useTeamTime(month)`.

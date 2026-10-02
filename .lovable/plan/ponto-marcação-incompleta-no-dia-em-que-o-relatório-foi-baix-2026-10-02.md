# Ponto: "Marcação incompleta" no dia em que o relatório foi baixado

## O que está acontecendo (conferido)
O último relatório de ponto foi baixado hoje às 14:26. Nesse horário, a Geise, a Ingrid e o Bruno estavam no meio do expediente. Cada um tinha só as marcações da manhã e do almoço, sem a saída do fim do dia:
- Geisiane: 08:02 até 13:59 (4h54)
- Ingrid: 08:04 até 13:35 (4h32)
- Bruno: 09:08 até 14:15 (4h06)

Como o dia ainda não tinha terminado, o próprio PontoFopag imprimiu "Marcações Incorretas" para esses dias no relatório. O sistema copiou essa observação e mostrou "Marcação incompleta". Não é erro de leitura: o dia ainda estava em andamento quando o relatório foi gerado. Os dias anteriores (30/09 e 01/10) estão corretos.

## Correção
- Nova situação **"Em andamento"** (cinza). Ela vale para o dia em que o relatório foi baixado, quando a pessoa já bateu entrada mas o dia ainda não terminou. Esse dia não conta como pendência nem entra nos cartões de "Marcações incompletas".
- Quando um relatório baixado num dia seguinte trouxer esse dia fechado, a situação passa a ser a real: regular, incompleta etc.
- Se o relatório for baixado depois do fim da jornada prevista e ainda faltar marcação, continua aparecendo **Marcação incompleta**, como hoje.
- Corrijo os três registros de hoje (02/10) para "Em andamento", sem mexer em horários nem em totais.

## Detalhes técnicos
- `cartaoPontoParser.ts`: recebe a data e hora de geração do arquivo, tiradas do nome `RelatorioCartaoPonto_DDMMAAAA_HHMMSS...`, com a data atual como alternativa. Para `dia === dia da geração`, quando há marcações e a hora de geração é anterior ao fim do horário previsto mais 30 min, a situação vira `em_andamento`, mesmo com a observação "Marcações Incorretas".
- `TeamSituacao` e rótulos/cores em `TeamTimePanel.tsx`: adicionar `em_andamento`, fora de `isPend` e dos contadores de incompletas. O `ManagerDayPanel` ignora essa situação.
- A Edge Function `pontofopag-sync` aceita `em_andamento` no `import_report`. Se a coluna tiver restrição de valores, uma migração amplia a lista.
- Ajuste dos 3 registros de 02/10 por atualização de dados (sem migração).

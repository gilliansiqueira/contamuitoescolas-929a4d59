# Ponto da Equipe: batidas do dia em ordem e saldo do mês

## 1. Batidas no meio do dia
Hoje, quando falta uma batida, o sistema supõe que a última é a saída final. Por isso, no meio do dia, a volta do almoço (ex.: 14:53) aparece no lugar da saída e o 14:00 fica vermelho.

Mudança: em dia **em andamento** (hoje, antes do fim da jornada), as batidas preenchem os horários em ordem (entrada, saída almoço, volta almoço, saída). Os que ainda não foram batidos aparecem em cinza, como "ainda não batido", e não em vermelho de falta.
Dias já encerrados continuam como hoje: a última batida conta como saída final e a do meio fica marcada como faltando.

## 2. Saldo do mês por pessoa
Na visão "Por mês", a tabela ganha a coluna **Saldo (extras − devidas)** ao lado de Extras e Devidas:
- Positivo em verde ("+03:20, a empresa deve")
- Negativo em laranja/vermelho ("−01:45, deve pagar horas")
- Zero: "00:00"

Também uma linha **Total** no fim da tabela, com a soma das extras, das devidas e do saldo de todas as pessoas mostradas.

O saldo é só do mês escolhido. Nada é guardado de um mês para o outro, porque não existe banco de horas.

## Detalhes técnicos
- `BatidasCelula` (TeamTimePanel.tsx) recebe `emAndamento` (situacao === 'em_andamento'); nesse caso, preenchimento sequencial com chip neutro para os horários futuros.
- Saldo = `extrasMin - devidasMin` das linhas já calculadas, só na tela. Os dados e a gravação não mudam.

# Tirar "Banco de horas" do "Meu ponto" da equipe e publicar

## O que muda

Na aba **"Meu ponto"** (a tela que cada colaboradora vê na Central), o card **"Banco de horas" sai**.
Ficam **3 cards**, lado a lado, ocupando a linha inteira:

1. **Horas extras no mês**
2. **Horas devidas no mês** (atrasos + saídas antes)
3. **Faltas no mês**

Abaixo, a tabela continua igual: dia a dia com as batidas, horas trabalhadas, extras, devidas e a situação do dia.
O botão **"Justificar"** continua aparecendo **só** para batida que não foi registrada — atraso e saída antes do horário nunca podem ser justificados, apenas vistos.

Suas telas de gestão (**Ponto da Equipe**) **não mudam**: as colunas "Banco de horas" e "Saldo banco de horas" continuam lá, como você escolheu.

## Depois

Publicar no site (https://relatorioscontamuito.online) e conferir no acesso de uma colaboradora (Rubia) que a tela aparece com os 3 cards, sem banco de horas, e que a justificativa continua funcionando.

## Detalhes técnicos

- `src/components/team/MyTeamTimeCard.tsx`: remover o 4º item do array `cards` (o de `hourBank`), tirar `hourBank` da desestruturação de `q.data`, remover o ícone `PiggyBank` do import e trocar o grid de `grid-cols-2 lg:grid-cols-4` para `grid-cols-2 lg:grid-cols-3`, para os três cards preencherem a linha.
- `src/hooks/useTeamTime.ts`: em `useMyTeamTime`, retirar a consulta a `team_time_hour_bank` (uma chamada a menos a cada abertura da tela) e o campo `hourBank` do retorno. O tipo `TeamHourBank` e a consulta em `useTeamTime` (tela de gestão) permanecem intactos.
- Nenhuma alteração de banco, permissão ou cálculo: `classifyDay` (fonte única de horas extras, devidas e faltas) não é tocado.
- Verificação: log de build sem erros; Playwright com sessão da Rubia abrindo a Central, conferindo os 3 cards, a ausência de "Banco de horas" e o envio de uma justificativa em um dia com batida faltando.

# Ponto: data de desligamento (Rubia e Isis)

## O que está acontecendo
- O Ponto não sabe que Rubia e Isis foram desligadas: as duas ainda constam como ativas e sem data de saída. Por isso, de 26/10 em diante, cada dia sem batida vira falta.
- A tela do mês soma esses dias inteiros como "horas devidas" (daí as ~5h). A planilha separa: atrasos em horas (os 40 min) e dias inteiros sem batida em "Dias Faltas". Então a planilha provavelmente também está com faltas indevidas nessa coluna.

## O que vou fazer
1. Adicionar no cadastro da funcionária no Ponto o campo "Desligada em" (só você edita).
2. Preencher 26/10/2026 para Rubia e Isis.
3. A partir dessa data (inclusive), os dias aparecem como "Desligada": sem falta, sem horas devidas, sem pendência nem botão de justificar — na tela do mês, no card delas e na planilha da contabilidade. Horas extras batidas antes continuam valendo.
4. Nos meses seguintes ao desligamento, elas saem da planilha da contabilidade e da lista do Ponto (histórico preservado).
5. Conferir outubro das duas: horas devidas na tela = atraso na planilha, e "Dias Faltas" sem os dias pós-desligamento.

## Detalhes técnicos
- Migration: `team_time_employees.desligado_em date null` (escrita super_admin; a sincronização `pontofopag-sync` não sobrescreve).
- `classifyDay` recebe a data e retorna tipo `desligado` para `dia >= desligado_em`; `payroll.ts` ignora esses dias e exclui quem foi desligado antes do mês.
- Teste em `payroll` cobrindo: dia do desligamento e posteriores não geram falta/atraso.

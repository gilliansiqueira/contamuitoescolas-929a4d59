# Feriados não contam como falta no Ponto

## O que muda
- Dias de feriado nacional (ex.: 12/10, 02/11, 20/11) aparecem como **"Feriado"** no Ponto, sem batidas exigidas.
- Não contam em **Faltas (dias)**, **Devidas**, **Batidas faltando** nem em "Dias com problema" — no painel da gestora e no cartão "Meu ponto" de cada colaboradora.
- Não aparece botão de justificar nesses dias.
- Se alguém bater ponto num feriado, as horas continuam aparecendo como extras normalmente.

## Feriados considerados
Nacionais fixos (01/01, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 20/11, 25/12) e móveis (Carnaval seg/ter, Sexta-feira Santa, Corpus Christi), calculados a partir da Páscoa — a mesma lista usada no prazo dos relatórios.

## Detalhes técnicos
- Novo `src/lib/teamTime/holidays.ts` com `isNationalHoliday(dia)` (Páscoa por algoritmo de Gauss).
- `classifyDay` em `TeamTimePanel.tsx` passa a devolver `feriado: true` e zera `faltaDia`/`faltaMin` quando o dia é feriado e não há batida; `isProblem` e `MyTeamTimeCard` ignoram esses dias e mostram o selo "Feriado".
- Teste em `src/test/teamTimeHolidays.test.ts`: 12/10/2026, 02/11/2026 e 20/11/2026 sem falta; 13/10/2026 sem batida continua falta.

# Ponto: saída do Bruno em 04/11 e feriado de 02/11

## Feriado de 02/11 (já resolvido)
A plataforma já reconhece 02/11 (Finados) como feriado nacional para todas as pessoas. Dia de feriado sem batida nunca conta como falta nem como horas devidas, e isso já vale na tela, no card e na planilha da folha. Também já estão cadastrados 01/01, Carnaval, Sexta-feira Santa, 21/04, 01/05, Corpus Christi, 07/09, 12/10, 15/11, 20/11 e 25/12. Não precisa mudar nada.

## Saída do Bruno em 04/11
Hoje dá para ignorar uma batida errada, mas não dá para incluir uma batida que faltou. O plano é:
1. Permitir uma "batida incluída" por dia, gravada só por super admin, sem mexer no que vem do PontoFopag. Assim, uma nova leitura do PontoFopag não apaga a correção.
2. Gravar para o Bruno, em 04/11, a saída às **18:40**. Com 08:51–13:00 e 14:01–18:40, o dia fecha em exatamente 8h48 e deixa de aparecer como "incompleta".
3. Na tela do Ponto, no dia com marcação faltando, adicionar o botão "Incluir batida", só para super admin, para corrigir casos assim sem precisar me pedir.

Resultado esperado do Bruno em novembro: 02/11 feriado, 04/11 regular e saldo de **+1h07 de extras** (05/11 +0h24 e 06/11 +0h43).

## Detalhes técnicos
- Migration: `team_time_daily_overrides.batidas_incluidas text[] not null default '{}'`, com as políticas atuais (leitura pela equipe autorizada/própria pessoa, gravação is_super_admin). A sincronização nunca grava essa coluna.
- `applyIgnoredPunches` (schedule.ts): remove as ignoradas, junta as incluídas, ordena e recalcula horas/situação. O teste novo cobre o caso 04/11, que tem de dar 8h48 e situação regular.
- `useTeamTime.ts`: as duas consultas passam a buscar também `batidas_incluidas`.
- Dados: gravar a linha (pf-34, 2026-11-04, batidas_incluidas={18:40}).
- AGENTS.md do pontofopag-sync: ajustar a regra de overrides.

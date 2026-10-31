# Corrigir o horário da Geovanna no Ponto

## O que encontrei
- O PontoFopag manda o horário dela como **12:30 · 14:00 · 14:15 · 18:15** (5h30 por dia). O certo é **12:00 · 14:00 · 14:15 · 18:15** (6h por dia).
- As horas extras e os atrasos de cada dia vêm prontos do PontoFopag, já calculados com o horário errado. Por isso quase todo dia aparece cerca de 30 min de "extra" que não existe. Exemplo: em 02/10 ela trabalhou 5h57 e o sistema mostra +00:27 de extra. Com o horário certo, faltam 3 minutos.
- A plataforma não tem um lugar para corrigir o horário. Além disso, cada atualização do PontoFopag regrava o horário errado.

## O que vou fazer
1. **Campo "Horário correto"** na aba Logins do Ponto, ao lado de "Desligada em". Só você poderá editar. Vou preencher o da Geovanna com 12:00 14:00 14:15 18:15.
2. **Recalcular os dias de quem tiver horário corrigido.** A plataforma vai somar as batidas do dia e comparar com as horas previstas:
   - trabalhou a mais → hora extra;
   - trabalhou a menos → atraso/saída antes.
   - Vou usar a mesma tolerância da CLT que o PontoFopag usa: até 10 minutos por dia não contam.
   - Dias com batida faltando continuam como "Batidas faltando", sem extra calculado. Feriado, atestado, justificativa aceita e desligamento seguem as regras de hoje.
3. **Mesmo resultado em todo lugar:** na tela do Ponto, no cartão "Meu ponto" dela e na planilha da contabilidade.
4. **As atualizações do PontoFopag não apagam a correção.** O horário corrigido fica guardado separado do que vem de lá.
5. Vou criar um teste com os dias reais dela (por exemplo, 02/10 sem extra e 07/10 com extra) para confirmar a conta.

Recomendo também corrigir o cadastro dela no PontoFopag, para o relatório oficial bater com a plataforma.

## Detalhes técnicos
- Migration: coluna `team_time_employees.horario_override text` (nullable). A escrita fica liberada só para super_admin, pela mesma política usada em `desligado_em`.
- `classifyDay` recebe um horário de override opcional. Quando ele existe, extra e falta saem de batidas em pares × total previsto (tolerância de 10 min/dia), em vez de `horas_extras` e "Faltas hh:mm" do relatório. A regra fica em uma função pura com teste em `src/test`.
- Os pontos de chamada (`TeamTimePanel`, `MyTeamTimeCard`, `PayrollSheet`) passam `e.horario_override ?? horário recebido`.
- A Edge Function `pontofopag-sync` não mexe na coluna nova.

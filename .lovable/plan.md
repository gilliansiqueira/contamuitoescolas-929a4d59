# Faixa vermelha e Controle com o mesmo número de projeções em atraso

## O que encontrei
- A faixa conta 63 porque olha o relatório de outubro (o mesmo do Controle) e aplica a regra dos 15 dias: "Projeções futuras" marcada antes de 15/10 não vale como entregue. Isso pega 15 escolas a mais.
- O Controle mostra cerca de 45 porque não aplica essa regra.
- A correção anterior, ainda não publicada, mudava a faixa para novembro. Está errada: as marcações da equipe estão em outubro (em novembro quase nada foi marcado ainda).

## O que vou fazer
1. **Mês igual ao Controle:** a faixa passa a usar o mesmo mês que o Controle abre (o mês anterior até o dia 20). Desfaço a troca para novembro.
2. **Manter a regra dos 15 dias, também no Controle:** "Projeções futuras" marcada antes de 15 dias do prazo aparece no Controle como não entregue (com aviso "marcada cedo demais, refazer"). Ela não conta como entregue para o relatório de novembro.
3. **Mesma conta nas duas telas:** Controle e faixa usam a mesma regra (`isProjectionDelivered`), e os números passam a ser iguais.
4. Mostrar à equipe quais escolas estão nessa situação, para remarcarem depois de refazer a projeção.

## Detalhes técnicos
- `TeamDeadlineNotice.tsx`: `projMonth` vem de `defaultReportMonth(today, …)` em vez de `projectionReportMonth`; atualizar `src/test/teamDeadlines.test.ts`.
- `ManagementCenter.tsx` / `TeamAlerts.tsx`: contagem de projeções em atraso via `overdueProjections`/`isProjectionDelivered`; selo para etapa `proj_futuras` concluída fora da janela.
- Conferir no banco: as duas telas devem dar o mesmo total (hoje ≈ 62 para outubro).

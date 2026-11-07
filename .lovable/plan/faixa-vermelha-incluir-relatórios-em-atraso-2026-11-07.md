# Faixa vermelha: incluir relatórios em atraso

## Situação
O aviso ativo tem dois prazos: "as projeções" (30/10) e "o texto e o relatório" (06/11). Hoje a faixa vermelha só conta projeções atrasadas. O prazo do relatório já venceu, mas a faixa ainda não conta as empresas sem relatório enviado.

## O que muda
- A faixa passa a mostrar as duas contagens, por exemplo: "🚨 45 projeções e 30 relatórios em atraso na equipe".
- Relatório atrasado = o prazo de relatório do aviso já passou e a empresa ainda não tem "Envio ao cliente" marcado no mês do Controle. É a mesma informação de "relatório entregue" que o Controle e a Central mostram.
- Na janela "Prazos de entrega", aparece um bloco "Relatórios em atraso" logo abaixo do bloco de projeções, no mesmo formato: agrupado por responsável para gestoras, só a própria carteira para cada colaboradora, e cada empresa abre ao clicar.
- A faixa atualiza sozinha a cada minuto e ao voltar para a aba. Quando a etapa de envio é marcada, a empresa sai da contagem.
- Empresas inativas ou restritas continuam fora, como já acontece hoje.

## Detalhes técnicos
- `src/lib/teamDeadlines.ts`: nova função pura `overdueReports(portfolio, reportDeadline, today)`, que filtra `!report_delivered` quando `today > reportDeadline`. O prazo de relatório é o último prazo do aviso ativo cujo rótulo não fala de "proje". Testes em `teamDeadlines.projections.test.ts`.
- `src/components/TeamDeadlineNotice.tsx`: buscar a carteira (`useManagementPortfolio`) quando qualquer um dos dois prazos estiver vencido, com `refetchInterval` de 60s. Montar o texto combinado e um segundo bloco na janela, reaproveitando a lista por responsável (extraída para um pequeno subcomponente).

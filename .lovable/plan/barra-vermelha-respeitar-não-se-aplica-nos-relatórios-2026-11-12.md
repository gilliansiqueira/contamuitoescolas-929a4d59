# Barra vermelha: respeitar "Não se aplica" nos relatórios

## O que está acontecendo
- **Projeções:** a barra já respeita "Não se aplica" (as 3 etapas marcadas assim contam como entregues).
- **Relatórios:** a barra só olha se o relatório foi enviado. Ela ignora quando "Envio ao cliente" está como "Não se aplica". Por isso Central Press, Conta Muito, Contorno, Quintal de Casa, Wizard IC, Wizard Leme, Wizard SF e WNC continuam aparecendo como relatório atrasado de outubro.

## O que vou mudar
1. A barra passa a considerar "Envio ao cliente = Não se aplica" como resolvido, igual ao que já acontece com as projeções.
2. Mesma regra na lista que abre ao clicar na barra (atrasos por responsável).
3. Um teste novo garantindo: relatório com "Não se aplica" nunca aparece como atrasado; sem envio e sem marcação continua atrasado.

Observação: a marcação é por mês. Em novembro essas empresas vão precisar ser marcadas de novo (hoje estão "aberto").

## Detalhes técnicos
- `src/components/TeamDeadlineNotice.tsx`: buscar `monthly_closing_checklist` com `step_key='envio_cliente'` e `status='not_applicable'` no mesmo mês e escopo, e excluir essas empresas de `overdueRep`.
- `src/lib/teamDeadlines.ts`: `overdueReports` recebe um conjunto opcional de empresas "não se aplica" e as ignora.
- Teste em `src/test/` para a regra.

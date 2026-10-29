# Aviso no notebook + Controle de relatórios em outubro

## 1. Aviso antigo no notebook
Não é preciso mudar nada no sistema. O celular já abriu a versão nova, e o notebook ainda está com a versão antiga guardada no navegador. Basta recarregar a página no notebook com **Ctrl + Shift + R**, ou fechar a aba e abrir de novo. Se a equipe usa o endereço oficial, ele só recebe o aviso novo depois de publicar.

## 2. Controle de relatórios abrindo em outubro
Como funciona hoje: a tela sempre abre no mês anterior. Por isso, em 29/10 ela ainda mostra setembro.

O que muda:
- **Mês que abre por padrão:** a tela abre no mês anterior até o **dia 20**, ou até antes disso se **todos os relatórios** do mês anterior já tiverem sido entregues. Depois, abre no mês atual. Hoje, 29/10, já abre em **outubro**. Em novembro, abre em outubro até o dia 20/11, ou até antes, se todos os de outubro forem entregues.
- **Novo filtro "Atrasados de meses anteriores":** ao ligar, aparecem junto as empresas com relatório **não entregue** dos meses anteriores, como setembro. Cada uma vem com a etiqueta vermelha "Relatório 09/2026 · prazo 06/10 · atrasado X dia(s)". As já entregues não aparecem.
- **Escolher o mês à mão:** continua funcionando como hoje.

## Detalhes técnicos
- `ManagementCenter.tsx`: uma função pura `defaultReportMonth(hoje, todosEntreguesMesAnterior)` escolhe o mês atual quando o dia é 20 ou depois, ou quando todos os relatórios ativos do mês anterior têm `report_delivered = true`. Nos outros casos, escolhe o mês anterior. Para isso, a tela consulta `get_management_portfolio` do mês anterior ao abrir.
- Novo interruptor: acrescenta à lista só as linhas do mês anterior com `report_delivered = false`, identificadas pelo mês de referência. Não altera nenhum cálculo financeiro.
- Teste: em 29/10/2026 abre em 2026-10. Em 05/11/2026, com pendentes, abre em 2026-10; sem pendentes, abre em 2026-11. Em 20/11/2026 abre em 2026-11.

# Aviso no notebook + Controle de relatórios em outubro

## 1. Aviso antigo no notebook
Não é preciso mudar nada no sistema. O celular já abriu a versão nova, e o notebook ainda está com a versão antiga guardada no navegador. Basta recarregar a página no notebook com **Ctrl + Shift + R**, ou fechar a aba e abrir de novo. Se a equipe usa o endereço oficial, ele só recebe o aviso novo depois de publicar.

## 2. Controle de relatórios abrindo em outubro
Como funciona hoje: a tela sempre abre no mês anterior. Por isso, em 29/10 ela ainda mostra setembro.

O que muda:
- **Mês que abre por padrão:** a tela abre no mês anterior só até o prazo dele vencer (5º dia útil). Depois disso, abre no mês atual. Ou seja, a partir de 07/10 já abre em **outubro**. Em novembro, até o dia 06/11, continua mostrando outubro, que é o mês a ser entregue.
- **Novo filtro "Atrasados de meses anteriores":** ao ligar, aparecem junto as empresas com relatório **não entregue** dos meses anteriores, como setembro. Cada uma vem com a etiqueta vermelha "Relatório 09/2026 · prazo 06/10 · atrasado X dia(s)". As já entregues não aparecem.
- **Escolher o mês à mão:** continua funcionando como hoje.

## Detalhes técnicos
- `ManagementCenter.tsx`: o mês inicial é calculado por `report_due_date` / regra do 5º dia útil já usada (`deadlineInfo`). Se hoje for depois do prazo do mês anterior, usa o mês atual.
- Novo interruptor: busca `get_management_portfolio` do mês anterior e acrescenta à lista só as linhas com `report_delivered = false`, identificadas pelo mês de referência. Não altera nenhum cálculo financeiro.
- Teste com datas fixas: em 29/10/2026 abre em 2026-10; em 03/11/2026 abre em 2026-10; em 10/11/2026 abre em 2026-11.

# Cards clicáveis da Central de Clientes (opção 1: filtrar a lista)

## O que você vai ver

Ao clicar em qualquer card do topo, a tabela de baixo passa a mostrar **só as empresas daquele card**. O card clicado fica marcado com um contorno laranja e a etiqueta "filtrando". Logo abaixo dos cards aparece um selo:

```text
[ Mostrando só: Extratos não enviados · 34 empresas  ✕ ]   Clique no mesmo card para limpar,
                                                            ou em outro card para trocar.
```

- Clicar no **mesmo** card de novo limpa o filtro e a carteira inteira volta.
- Clicar em **outro** card troca o filtro na hora.
- O número grande do card e a quantidade de linhas da tabela passam a ser sempre a mesma coisa, calculados pela mesma regra — nada de "34" no card e 30 na lista.
- Busca, filtro de situação e a troca Hoje / Dia anterior / Mês continuam funcionando por cima do filtro, e o rodapé avisa o que está ativo: "Mostrando 34 de 63 empresas · Extratos não enviados".
- Card com zero empresas fica acinzentado e sem clique (evita lista vazia).

Nada muda nos dados: é só leitura, sem tocar em nada do financeiro.

## Quais cards ficam clicáveis (cada visão tem o seu conjunto)

**Dia anterior**
- Extratos não enviados → empresas sem extrato da data de referência
- Fecharam 100% → com movimento e zero pendência no dia
- Deixaram pendência → com movimento e pendência no dia
- Pendências acumuladas → empresas com lançamento pendente de dias anteriores

**Hoje (ao vivo)**
- Extratos não enviados → ainda sem extrato hoje
- Conciliação em andamento → movimento com pendência hoje
- Concluídas hoje → movimento zerado hoje
- Sem atividade hoje → ninguém usou a plataforma hoje

**Mês**
- Empresas ativas → a carteira toda
- Atualizadas hoje → dados até hoje
- Conciliação pendente → pendência no mês
- Fechamento pendente → período não fechado ou relatório não entregue

## Como funciona por dentro

Um único estado novo, `cardFilter`, guarda qual card está ativo. Cada card passa a ter uma regra de "pertence ou não" (empresa + situação do dia + pendências acumuladas). Essa mesma regra é usada duas vezes: para contar o número do card e para filtrar a tabela. Por isso os dois batem sempre.

Ao trocar Hoje / Dia anterior / Mês, o filtro é limpo automaticamente, porque os cards são outros.

## Detalhes técnicos

- Arquivo alterado: `src/components/management/ManagementCenter.tsx` (somente este).
- `summaryCards` vira lista de objetos com `key`, `label`, `note`, ícone/tom e um predicado `match(row, daily, backlogCount)`.
- O `useMemo` de `filtered` recebe o `cardFilter` e aplica o predicado do card ativo, junto com busca, visão e situação.
- Contagem dos cards passa a usar o mesmo predicado (elimina a divergência atual entre `withMovement` e a lista).
- Cards viram `<button>` com `aria-pressed`, foco visível e `disabled` quando a contagem é zero; marcador visual com tokens de tema (`ring-primary`), sem cor fixa.
- Selo de filtro novo abaixo da linha de cards, com botão ✕ para limpar.
- Nenhuma migration, nenhuma consulta nova no banco, nenhuma escrita. Dados financeiros intocados.

## Como vou conferir

- Rodar a prévia logada como adm@contamuito, nas três visões (Hoje, Dia anterior, Mês).
- Clicar cada card e comparar o número do card com o rodapé "Mostrando N de M empresas · <card>".
- Testar limpar no ✕, trocar de card, combinar com a busca e com a situação.
- Conferir claro e escuro, e o comportamento quando um card tem zero empresas.
- Checar o log de build e o typecheck antes de dizer que está pronto.

As mudanças ficam na prévia. Publicar no site oficial só quando você pedir.

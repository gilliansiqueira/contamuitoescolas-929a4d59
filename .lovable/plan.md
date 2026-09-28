## Divididos com parte "Ignorar" também em "Ignorados"

**Confirmado:** hoje, quando um lançamento é dividido, ele aparece só em "Divididos". Mesmo que uma parte esteja como "Ignorar" (por exemplo Hauer, Boa Vista e Campo Largo no print da PARCELA GIRO 24/42), ele não aparece no filtro "Ignorados".

### O que muda
- Com o filtro **Ignorados**, os lançamentos divididos que têm alguma parte como "Ignorar" também aparecem.
- A linha fica marcada "Dividido em N". Ao abrir, aparecem todas as partes, e as partes "Ignorar" ficam destacadas.
- Os totais do resumo (Entradas, Saídas e Diferença) com o filtro Ignorados passam a somar **só o valor das partes ignoradas**, e não o lançamento inteiro. Assim a conta fica certa. Exemplo: a PARCELA GIRO soma R$ 3.892,76 (506,00 + 506,00 + 2.880,76) nas saídas.
- O filtro "Divididos" continua igual.
- Nenhum valor muda em Receita, Despesa, Resultado ou Caixa. A mudança é só no filtro da tela.

### Detalhes técnicos
- `BankTransactionsTable.tsx`: o filtro de categoria passa a aceitar vários grupos. Com `cat === 'ignorar'`, também entram os lançamentos com `splits.some(sp => sp.categoria === 'ignorar')`. `catOf` continua igual para os outros filtros.
- Resumo/CrossLine: com o filtro Ignorados, se o lançamento for dividido, soma apenas `splits` com categoria `ignorar`.
- Sem migração no banco. A classificação continua usando as regras centrais do sistema.

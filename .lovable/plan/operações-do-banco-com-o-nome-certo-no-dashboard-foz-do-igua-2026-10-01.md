# Operações do banco com o nome certo no Dashboard (Foz do Iguaçu e demais)

## Situação atual
- A correção anterior tirou as operações do Resultado, mas agrupou tudo em dois cards: "Operações (banco) - entrada" e "Operações (banco) - saída". Os nomes escolhidos pela equipe (Antecipação, Saída Empréstimo, Pró-Labore etc.) se perderam.
- Os cards "Movimentações ignoradas (banco)" de entrada e saída aparecem em Operações Financeiras. Em Foz eles se anulam (R$ 2.219,30 de cada lado) e só poluem a tela.

## O que muda
- Cada operação do Fluxo Bancário entra no Dashboard com o nome do item escolhido na segunda caixa da classificação. Exemplo em Foz:
  - Antecipação (entrada): R$ 33.506,76.
  - Saída Empréstimo e Pró-Labore (saídas) aparecem em cards separados, com o valor de cada um.
- Continuam fora de Receita, Despesa e Resultado e afetam só o Caixa. Vale mesmo para Pró-Labore, que no modelo está como "entra no resultado". A escolha "Operação" no Fluxo prevalece.
- Operação sem item escolhido continua no card genérico "Operações (banco) - entrada/saída".
- Os cards de "Movimentações ignoradas (banco)" saem de Operações Financeiras no Dashboard e no PDF. O saldo continua considerando esses valores, como hoje.
- Resultado, Saldo final e totais não mudam. Muda só como os cards aparecem.

## Detalhes técnicos
- `useFinancialData.ts`: ao montar o overlay, buscar o nome dos itens do modelo (`financial_model_template_items`) pelos `model_item_id` das linhas do fluxo e enviar `item_nome`.
- `bankCashflowOverlay.ts`: quando `tipo_nome === 'Operação'` e existir `item_nome`, gravar `tipoOriginal = 'Operação (banco): <item>'`. Sem item, mantém as constantes atuais.
- `ledgerEngine.resolveEntryLedgerRule`: o prefixo `operacao (banco):` sempre resolve para `{impactaCaixa: true, entraNoResultado: false}`, com sinal pelo `entry.tipo` e `label` igual ao nome do item. Isso vem antes de qualquer `type_classifications` ou DEFAULT_MAPPINGS.
- `Dashboard.tsx` (cards e `reportOperations`): filtrar os rótulos `IGNORADO_ENTRADA`/`IGNORADO_SAIDA`.
- Testes: Pró-Labore com o prefixo resulta em `operacao` com o label "Pró-Labore". Antecipação entrada soma no caixa.
- Atualizar a regra do overlay no AGENTS.md.

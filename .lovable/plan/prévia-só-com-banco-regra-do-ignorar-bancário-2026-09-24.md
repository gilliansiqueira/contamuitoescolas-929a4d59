# Prévia só com banco + regra do Ignorar bancário

## Causa encontrada (Santa Mônica, setembro)
As meninas classificaram 4 lançamentos do banco como **Ignorar**: 1 entrada de R$ 450,00 e 3 saídas que somam R$ 11.147,00. A diferença líquida é de **R$ 10.697,00**.
- Na conciliação, o saldo bate porque ela soma tudo o que passou pelo banco.
- No Dashboard, o Ignorar hoje não entra em nada, nem no saldo. Por isso o saldo do Dashboard fica R$ 10.697,00 acima do banco.
- Todas as operações (Distribuição de lucros R$ 14.000, Saída Aporte R$ 4.570, Compra da Escola R$ 3.500) já mexem no saldo, como deveriam.

## O que vai mudar

1. **Ignorar vindo do banco mexe só no saldo**
   - Não entra em Receita, Despesa nem Resultado.
   - Entra no saldo, porque o dinheiro de fato passou pela conta. Assim o saldo do Dashboard e o do Fluxo Diário ficam iguais ao do banco.
   - Vale só para lançamentos do Fluxo Bancário. O Ignorar das planilhas antigas e de outras empresas continua como está.
   - No Dashboard, esse valor aparece junto das operações fora do resultado, com o nome "Movimentações ignoradas (banco)". Assim a conta fecha: saldo inicial + resultado + operações + ignoradas = saldo final.

2. **Prévia sem planilhas**
   - Sai a coluna "Hoje (planilha)". Fica só **Com o Fluxo de Caixa × Banco**.
   - Linhas: entradas, saídas, receitas, despesas, operações, ignoradas (banco), movimento no caixa e saldo.
   - A comparação com a planilha na aba de conferência (divergências, período comparado) fica recolhida e deixa de contar como alerta.

3. **Saldo inicial: continua o fechamento de agosto**
   - Setembro continua herdando o saldo final de agosto do Dashboard.
   - Na prévia, a diferença para o banco em 31/08 aparece só como informação e não impede a ativação.
   - Para comparar com o banco, a prévia usa o movimento de setembro, que precisa bater exatamente.

4. **Validação**
   - Conferir que, em Santa Mônica, o movimento de setembro com o Fluxo de Caixa fica igual ao do banco.
   - Conferir que o botão "Aprovar e ativar" é liberado.
   - Confirmar que Centro, Dourados e as demais empresas não mudam.

## Detalhes técnicos
- `applyCashflowOverlay`: linhas com `tipo_nome = 'Ignorar'` passam a ser enviadas com um tipo nativo de operação que impacta só o caixa ("Movimentações ignoradas (banco)"). A regra passa pelo `ledgerEngine` (`resolveNativeOperationRule`/DEFAULT_MAPPINGS), sem cálculo paralelo na tela. Isso vale só para as linhas `bcf-*`.
- `ActivationPreview`: remover a coluna da planilha. `bankMov` continua igual (entradas − saídas geradas, incluindo o Ignorar). O critério de liberação é `saldoMovimentoRealizado === bankMov` e zero lançamentos "A classificar". A diferença do saldo inicial é só informativa.
- `CashflowConference`: seções da planilha dentro de um Accordion fechado, fora do veredito do topo.
- Sem alteração de banco de dados, de `financial_entries` nem de meses anteriores a 09/2026.

# Vitória: pró-labore dos sócios como retirada (fora das despesas)

## O que muda para você
- Em Vitória, todo o pró-labore de Júlia Gava e Vinicius Reis passa a ser tratado como retirada dos sócios, igual à distribuição de lucros: sai das despesas e do resultado, mas continua tirando dinheiro do caixa.
- Lucratividade operacional: sem a retirada deles.
- Lucratividade total: considerando a retirada (já é assim que o indicador funciona, porque soma as operações).
- Vale só para Vitória. As outras empresas que usam o mesmo modelo financeiro não mudam.

## Passos
1. Lançamentos previstos de Vitória com categoria "Pro-Labore" (Júlia e Vinicius, jul/2026 a dez/2027) passam para "Distribuição de Lucros (DLL)", mantendo valor, data e origem.
2. Lançamentos do extrato de Vitória classificados como "Pró-Labore" (out e nov/2026, R$ 30 mil) passam para o item "Distribuição de lucros" do modelo.
3. Garantir que o nome "Distribuição de Lucros (DLL)" seja reconhecido pelas regras oficiais como operação (hoje só existe a variação "(DL)"); se não for, incluir essa variação nas regras oficiais — vale para qualquer empresa que use esse nome, sempre como operação.
4. Daqui para frente, novos lançamentos de pró-labore em Vitória (no extrato e na projeção) já caem como retirada.
5. Recalcular a lucratividade automática dos meses encerrados de Vitória (sem tocar em meses fechados) e conferir no Dashboard: operacional sobe, total fica igual ao de antes.

## Detalhes técnicos
- Escola 982fe1b7-0359-45fa-8981-0e3e6c2bb19d. Modelo "Escola" é compartilhado, então não alterar o item "Pró-Labore" do modelo; em vez disso, regra por empresa (classificação por empresa na SSOT, via `resolveLedgerRule` com classificações da escola) mapeando "Pro-Labore"/"Pró-Labore*" → operação de saída, só em Vitória.
- Correção de dados via run_sql em `financial_entries` (categoria) e `bank_transactions.model_item_id` (Pró-Labore 0e4b87d7… → Distribuição de lucros c6621edd…), respeitando gatilhos de mês fechado.
- Se necessário, adicionar `'distribuicao de lucros (dll)'` em `DEFAULT_MAPPINGS` do `ledgerEngine` e teste correspondente.
- Teste: pró-labore em Vitória não entra no resultado e impacta caixa; nas demais empresas segue despesa.

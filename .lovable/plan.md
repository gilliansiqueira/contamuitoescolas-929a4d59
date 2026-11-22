# Ather: tirar as linhas de saldo que entraram como receita e despesa

## O que encontrei
No extrato do Itaú enviado em 10/11 (Extrato_0274_985712_10-11-2026.ofx) vieram 6 linhas que são só o saldo da conta, não movimento. Elas entraram como lançamentos e foram classificadas:

| Data | Linha do extrato | Valor | Classificado como |
|---|---|---|---|
| 02/11 | SALDO ANTERIOR | R$ 20.673,79 | Despesas (saída) |
| 03/11 | SALDO TOTAL DISPONÍVEL DIA | R$ 24.220,81 | Receita |
| 04/11 | SALDO TOTAL DISPONÍVEL DIA | R$ 10.720,49 | Receita |
| 05/11 | SALDO TOTAL DISPONÍVEL DIA | R$ 9.394,23 | Receita |
| 06/11 | SALDO TOTAL DISPONÍVEL DIA | R$ 49.086,47 | Receita |
| 09/11 | SALDO TOTAL DISPONÍVEL DIA | R$ 77.144,70 | Receita |

Efeito em novembro: receita inflada em R$ 170.566,70, despesa inflada em R$ 20.673,79 e caixa somando R$ 149.892,91 a mais. Todas estão pendentes (não conciliadas) e nenhuma foi enviada a outro sistema. Nenhum outro extrato da Ather tem linhas assim.

A leitura de extratos OFX já foi corrigida depois desse envio: hoje linhas que começam com "SALDO" são descartadas. Por isso não acontece de novo; só falta limpar essas 6.

## O que vou fazer
1. Apagar essas 6 linhas do Fluxo Bancário da Ather (só elas, pelo identificador de cada uma).
2. Conferir que o saldo final da conta Itaú no sistema bate com o último saldo do extrato (R$ 77.144,70 em 09/11) e que a receita/despesa de novembro baixaram exatamente nos valores acima.
3. Recalcular a lucratividade de novembro, se já tiver sido gravada.
4. Te mandar o resumo antes × depois.

## Detalhes técnicos
- Exclusão via `supabase--run_sql` em `bank_transactions` filtrando `school_id` da Ather, `import_id` do arquivo de 10/11 e `descricao ilike 'saldo%'` (6 ids). Gatilhos de `bank_cashflow_entries` limpam o espelho.
- Sem mudança de código: `parseOFX` já ignora `^saldo\b`.

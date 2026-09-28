# Ather: setembro bloqueado no seletor de período

## Motivo
O seletor só libera os meses em que a empresa tem **projeção**, **histórico mensal** ou **mês fechado**. A Ather não tem nenhuma projeção cadastrada, e o histórico dela vai só até agosto. Os extratos de setembro estão no Fluxo Bancário, mas o seletor ainda não olha para ele. Por isso setembro (e janeiro) aparecem apagados.

## O que vou fazer
1. O seletor também vai liberar os meses que tenham:
   - lançamentos de extrato no Fluxo Bancário;
   - lançamentos do Realizado.
2. Vale para todas as empresas. Assim, qualquer uma que tenha extrato de setembro poderá escolher setembro.
3. Nenhum valor muda: é só o seletor que passa a mostrar mais meses.
4. Conferir na tela da Ather que setembro fica clicável e que o Resumo mostra o mês. Hoje aparece "até NaN/all" em "Todos os meses", e isso também será corrigido para mostrar a data certa.

## Detalhes técnicos
- Migration: recriar `get_available_financial_months` somando `LEFT(bank_transactions.data,7)` e `LEFT(realized_entries.data,7)` da escola, com o mesmo filtro de formato `^[0-9]{4}-[0-9]{2}$`.
- FluxoBancario Resumo: tratar o período "all" no texto "até …", usando a última data com saldo.

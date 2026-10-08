# Produtos mais vendidos: lista por valor separada da lista por quantidade, e opção de apagar o mês

## O que muda para a equipe
1. **"Colar vendas do mês" com duas abas:**
   - **Por valor:** cola a lista usada no ranking de valor (Produto | Valor | Quantidade).
   - **Por quantidade:** cola a lista usada no ranking de quantidade (Produto | Valor | Quantidade).
   - Cada aba tem sua própria conferência (produtos lidos, total em valor, total em quantidade) e grava só a lista dela. Reenviar o mesmo mês substitui só aquela lista, sem duplicar.
2. **Tabelas da tela:** "Por valor" mostra só a lista de valor e "Por quantidade" só a lista de quantidade. Se uma das listas não tiver sido enviada no mês, a tabela avisa "Lista não enviada neste mês".
3. **Apagar dados do mês:** novo botão **"Apagar mês"** (só para a equipe). Você escolhe o mês e o que apagar (Por valor, Por quantidade ou as duas listas) e confirma antes. A ação fica registrada no Histórico de Alterações.
4. **Dados já lançados (Jurassic etc.):** o que já foi colado continua aparecendo nas duas tabelas, como hoje, até alguém colar a lista certa de quantidade para aquele mês. Nada se perde.
5. **Gráfico de evolução:** valor vem da lista de valor e quantidade da lista de quantidade.

## Cuidados
- Continua fora de qualquer cálculo financeiro (Receita, Resultado e Caixa não mudam).
- Clientes continuam só consultando.

## Detalhes técnicos
- Migração: `product_sales_monthly.ranking text not null default 'valor' check (ranking in ('valor','quantidade'))`; copiar as linhas existentes como `ranking='quantidade'` para preservar a tela atual; trocar o único para (`school_id`,`month`,`ranking`,`produto`). RLS existente cobre.
- `useProductSales.ts`: `ProductSaleRow.ranking`; `useReplaceProductSalesMonth` recebe `ranking` e apaga/insere só aquele ranking; novo `useDeleteProductSalesMonth(month, rankings[])` + insert em `audit_log`.
- `ProdutosMaisVendidos.tsx`: abas no diálogo de colar; `RankingTable` recebe as linhas filtradas por ranking; diálogo de confirmação "Apagar mês"; gráfico usa valor do ranking valor e quantidade do ranking quantidade.

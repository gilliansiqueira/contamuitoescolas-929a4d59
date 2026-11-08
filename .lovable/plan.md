# Remover os duplicados da Olist na WNC

## Situação atual
Os 41 lançamentos enviados pela plataforma (03/11 a 06/11, R$ 142.415,99) **ainda estão na Olist**. Ninguém rodou a limpeza ainda.

## O que vou fazer
1. Rodar a prévia da limpeza (nada é apagado) e conferir quais desses 41 têm um lançamento igual feito pela equipe na Olist (mesmo dia, sentido e valor).
2. Apagar na Olist só os que a plataforma criou e que estavam repetidos. O que a equipe lançou nunca é apagado; o que faltava na Olist fica.
3. Rodar a conferência banco × Olist desde 01/11 e mostrar a diferença (o objetivo é R$ 0,00), com os dias que ainda causam diferença, se sobrar algum.
4. Te mostrar o resultado: quantos foram apagados, quantos ficaram e a diferença final.

## Detalhes técnicos
- Chamar a função `olist-sync` com `dedup_cleanup` (`dry_run=true`, depois `false`) e `reconcile` para a escola WNC.
- Atualizar `erp_push_log` dos apagados para não serem reenviados.

# Remover pendências anteriores a 01/10 — só Praia da Costa e Manaus Centro

## O que encontrei
- **Manaus Centro:** 33 pendências de 06/08 a 31/08 (R$ 24.367,86).
- **Praia da Costa:** 19 pendências de 12/08 a 31/08 (R$ 20.768,49).
- Não há pendências em setembro nessas duas escolas.
- Há lançamentos **já conciliados** em agosto e setembro (200 em Manaus, 54 em Praia da Costa). Esses não serão mexidos.

## O que vou fazer
1. **Apagar as 52 pendências** com data anterior a 01/10 nessas duas escolas (só as pendentes; conciliadas ficam).
2. **Daqui pra frente:** quando subirem extrato com datas antes de 01/10 nessas duas escolas, essas linhas serão ignoradas na importação, com aviso de quantas foram descartadas (mesmo comportamento já usado nas Wizard).
3. Nenhuma outra escola muda.

## Detalhes técnicos
- Exclusão via SQL em `bank_transactions` filtrando `school_id` das duas escolas, `data < '2026-10-01'` e `recon_status='pendente'`; conferir antes que não há splits/vínculos órfãos.
- Ligar `school_features.extrato_corte_inicio` nas duas escolas. Hoje `school_data_sources.start_month` delas é `2026-09`; para não afetar o mês de setembro já conciliado nos relatórios, o corte usará uma data própria (01/10) em vez de alterar o `start_month`.
- Edge function `bank-statement-import` implantada após o ajuste; testes do corte atualizados.

# Ather — Pix entre as próprias contas viram transferência (novembro/2026)

## O que encontrei
- 8 pares de Pix Inter → Itaú com o nome da própria Ather (03, 04, 05, 06, 09, 10 e 18/11) estão classificados como **Receita** (no Itaú) e **Despesas** (no Inter), num total de R$ 619.570,10 de cada lado. Isso infla receita e despesa de novembro pelo mesmo valor.
- Os pares de 19/11 e 23/11 (R$ 81.673,39) já estão como transferência, e assim continuam.
- Os 3 Pix enviados do Itaú para a Ather/Domínio sem par (05/11 R$ 2.663,82; 06/11 R$ 44.495,79; 19/11 R$ 14.314,28) são pagamentos de folha e adiantamento: **continuam como Despesas**.
- Os aportes da Rahissa (R$ 57.000,00) já estão certos e não mudam.

## O que vou fazer
1. Marcar os 16 lançamentos (8 entradas no Itaú e 8 saídas no Inter) como transferência entre contas e retirar o item Receita/Despesas. Eles passam a mexer só no Caixa, como os de 19 e 23/11.
2. Manter a conciliação e o par já formado. Os saldos das contas não mudam.
3. Conferir depois: receita e despesa de novembro caem R$ 619.570,10 cada uma, e o resultado e o Caixa ficam iguais.
4. Procurar o mesmo padrão em outubro na Ather e avisar se encontrar, sem alterar nada.

## Detalhes técnicos
- Alteração de dados em `bank_transactions` da escola a7786ff0-…: `movement_kind='transferencia'`, `model_item_id=null` somente onde `transfer_pair_id` não é nulo, a descrição tem ATHER ENGENHARIA, a data cai em 01–30/11 e `movement_kind='normal'`.
- Não muda nenhum código e nenhuma regra de cálculo (SSOT).

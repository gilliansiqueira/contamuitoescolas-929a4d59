# Palmital: limpar lançamentos falsos e mostrar as pendências reais

## O que encontrei
- **Itaú Palmital:** em 05/11 subiram o arquivo **"Entradas_Saidas_ag0143cc985208_05-11-26.ofx"**, que é um relatório de entradas e saídas do Itaú, não o extrato. Ele trouxe **12 linhas de saldo** gravadas como se fossem dinheiro entrando ("SALDO ANTERIOR", "SALDO TOTAL DISPONÍVEL DIA", "SALDO TOTAL", "SALDO BLOQUEADO"). Juntas somam **R$ 3.024,45** de entradas que não existem. É daí que vêm os saldos estranhos nas pendências.
- O mesmo arquivo também trouxe movimentações verdadeiras de 03/11 e 04/11: boletos Influx/Sonoda, PIX da Conexão e do Filipe, depósito de cheque de R$ 344,40 e a tarifa de R$ 169. Essas entraram só por ele, porque o extrato de 03/11 não trouxe nada novo. **Por isso elas ficam.**
- As outras contas (Asaas, BB, Bradesco, Stone, Inter) não têm linhas de saldo falsas.
- **Stone:** há 55 pendências antigas, de junho a agosto/2026 (2 em junho, 33 em julho e 20 em agosto), anteriores ao uso atual. Vou listá-las separadas para você decidir.

## O que vou fazer
1. **Apagar só as 12 linhas de saldo do Itaú**, uma por uma, pela identificação de cada linha. Nenhum lançamento verdadeiro sai, e o registro do arquivo continua guardado.
2. **Impedir que se repita:** na importação de extratos, linhas cujo texto começa com "SALDO" (anterior, total, disponível, bloqueado) passam a ser ignoradas e aparecem no aviso da conferência como "linhas de saldo ignoradas".
3. **Entregar a lista de pendências reais de Palmital** por conta, com data, descrição e valor, separando:
   - pendências do dia a dia (out/nov), que a equipe precisa conciliar;
   - pendências antigas da Stone (jun–ago) e do Bradesco (set);
   - um resumo por conta depois da limpeza: Itaú, BB, Bradesco, Asaas, Stone.
4. Conferir que o total pendente do Itaú caiu exatamente R$ 3.024,45 e que nenhuma linha conciliada foi tocada.

## Detalhes técnicos
- Apagar só `bank_transactions` com `import_id` do arquivo Entradas_Saidas, conta Itaú, descrição `ILIKE 'SALDO%'` (12 ids, conferidos antes).
- Regra de ignorar "SALDO*" no parser OFX da Edge Function `bank-statement-import`, com teste, seguindo o AGENTS.md dela.
- Planilha da lista de pendências em /mnt/documents.

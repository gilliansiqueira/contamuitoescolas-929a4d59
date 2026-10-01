# Floripa Ingleses – diferença de R$ 50,00 (Itaú)

## O que já foi confirmado nos dados
- A diferença é só na conta **Itaú**. O Asaas fecha certinho em R$ 2.444,91 em 01/10.
- Itaú: o extrato de 01/10 termina em **-R$ 2.574,76**. O sistema chega em **-R$ 2.624,76**, ou seja, R$ 50,00 a menos.
- O último extrato importado (de 24/09 a 01/10) tem **R$ 6.348,19 de entradas**. No sistema, o mesmo período soma **R$ 6.298,19**. As saídas batem centavo por centavo (R$ 13.698,93).
- Conclusão: **falta um recebimento de R$ 50,00** entre 24/09 e 01/10. A importação descartou esse recebimento achando que era repetido. No sistema, o único Pix de R$ 50 nesse período é o da Manuela, em 29/09.
- Nenhum lançamento a mais, nenhuma saída errada e o saldo inicial está certo.

## O que falta
1. Abrir o arquivo do extrato de 01/10, que está salvo no sistema, e achar a linha exata de R$ 50,00 que não entrou (nome, data).
2. Conferir por que ela foi tratada como repetida. A suspeita é que dois Pix de R$ 50 no mesmo dia, com descrição parecida, foram vistos como um só.
3. Incluir esse recebimento no Itaú de Floripa Ingleses, deixando registrado no histórico, e atualizar o fluxo. O saldo deve fechar em -R$ 2.574,76.
4. Se a causa for a regra que identifica repetidos, ajustar para que dois Pix diferentes de mesmo valor e mesma data nunca sejam juntados, e criar um teste automático para isso. Vale para todas as empresas.

## Detalhes técnicos
- Comparar `bank_statement_imports` 01/10 (total_linhas 41 x 40 no banco) com o OFX do storage, por FITID/bank_ref.
- Inserção pelo mesmo caminho de importação (import_id do arquivo de 01/10), com `audit_log` e `sync_bank_cashflow_school`.
- Revisar a deduplicação do Itaú/OFX em `parsers`/importação para considerar FITID e nome do pagador.

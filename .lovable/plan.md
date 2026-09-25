# Banco do Brasil de Dourados: diferença explicada pelo lançamento futuro

## O que a conferência mostrou
Você tinha razão. A conta fecha assim:

```text
Total calculado pelas linhas até 25/09 (em conta + aplicado)   151.130,00
(-) PGT CARTAO 25/09 (lançamento futuro, não veio no arquivo)   -2.159,03
(+) Rendimento do BB Rende Fácil (não veio no arquivo)             +21,21
= Total real no fim de 25/09                                   148.992,18
```

- 148.992,18 é exatamente o aplicado do extrato, com a conta zerada: o banco já resgatou da aplicação para cobrir a VIVO (190,53) e o pagamento do cartão.
- Então o seu saldo esperado de 207.107,14 está certo. A diferença não é erro de lançamento: são 2 linhas que o banco só manda no próximo arquivo.
- Todas as outras contas batem centavo por centavo. Nenhum lançamento foi alterado.

## O que vou fazer
1. Na lista "A confirmar no próximo extrato", mostrar a diferença do BB (2.137,82) com a explicação "provável lançamento futuro / rendimento ainda não lançado". Isso não trava o Dashboard nem o Fluxo Diário.
2. Quando entrar o próximo extrato do BB com o PGT CARTAO de 2.159,03 e o rendimento, a pendência some sozinha. Se não sumir, ela continua visível para a equipe.
3. Verificar um caso parecido em 22/09: o cheque de 580,80 aparece 3 vezes (depósito, devolução e novo depósito). Confirmar que só o depósito válido conta como receita.

## Detalhes técnicos
- Não criar lançamento sintético para o PGT CARTAO. Isso evita duplicar quando o próximo OFX trouxer a linha real (a regra de deduplicação é por dedup_hash).
- A pendência sai da diferença entre o saldo informado pelo extrato e o saldo calculado pelas linhas, por conta e data, e é recalculada a cada importação.
- É só leitura e exibição. Nenhuma escrita em bank_transactions.

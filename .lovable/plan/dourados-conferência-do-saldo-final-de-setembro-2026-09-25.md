# Dourados: conferência do saldo final de setembro

## O que foi confirmado
- **Receita e Despesa do Dashboard estão certas** pelas regras que você escolheu. As diferenças para o fechamento vêm de:
  - 4 cheques depositados e devolvidos (R$ 2.057,80), que continuam como **Ignorar**;
  - 2 parcelas de empréstimo (R$ 8.082,24), que ficam **só no caixa**.
- **Saldo por banco, segundo os extratos importados (até 25/09):**

| Conta | Saldo no extrato |
|---|---|
| Banco do Brasil (conta corrente) | -190,53 |
| Banco do Brasil (aplicação) | 148.992,18 |
| Inter | 57.418,04 |
| Bradesco (até 18/09) | 78,54 |
| Sicredi (conta + aplicação calculada) | 617,96 |
| Stone | 0,00 |
| **Total nos bancos** | **206.916,19** |

- **Dashboard:** R$ 209.244,54, ou seja, R$ 2.328,35 acima dos bancos.
- **Fechamento:** R$ 207.106,72. Esse valor é o total dos bancos considerando a conta corrente do BB zerada, em vez de -190,53.
- **Onde está a diferença do Dashboard:** toda ela está na **aplicação do Banco do Brasil**. O sistema parte de R$ 122.078,73 em 31/08, soma aplicações automáticas (R$ 35.211,28) e desconta resgates (R$ 5.969,48), chegando a R$ 151.320,53. O extrato informa R$ 148.992,18. Faltam **R$ 2.328,35 em resgates**, ou o saldo aplicado de 31/08 está maior do que o real.

## O que vou fazer
1. Abrir os extratos do BB de setembro e o saldo aplicado de 31/08 para achar, linha a linha, os resgates que não foram lidos ou a diferença no saldo inicial.
2. Se forem resgates que a leitura do extrato perdeu: corrigir a leitura, reimportar só o extrato de setembro do BB e conferir que a aplicação fecha em R$ 148.992,18. Nenhum lançamento anterior a setembro é alterado.
3. Se for o saldo inicial de 31/08: mostrar o valor certo e pedir sua confirmação antes de mudar.
4. Enquanto isso não for resolvido, a diferença aparece em "A confirmar no próximo extrato", sem travar o Dashboard.
5. Confirmar com você a conta corrente do BB (-190,53): o extrato mostra saldo negativo, e o fechamento usou zero.

## Detalhes técnicos
- Conta BB `62acc94d…`: comparar `movement_kind in (auto_aplicacao, auto_resgate)` com as linhas do extrato (PDF/OFX) e revisar a regra de aplicação automática (`bank_auto_invest_patterns`) no parser.
- Não mudar receita/despesa nem classificações.

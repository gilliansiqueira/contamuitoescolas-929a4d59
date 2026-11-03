# Rondonópolis: histórico de jan a ago/2026 (e depois 2025)

## O que os extratos de dezembro mostram
Saldo em conta corrente no fim de 31/12/2025:

| Conta | Saldo |
|---|---|
| BB | R$ 0,00 (tudo vai para o Rende Fácil automaticamente) |
| Sicredi | R$ 328,71 (último movimento em 18/12) |
| Stone | R$ 0,01 |
| **Total em conta** | **R$ 328,72** |

Os valores aplicados (BB Rende Fácil e os fundos do Sicredi) não aparecem nesses extratos.

## Como vou montar
1. **Saldo inicial em 01/01/2026: R$ 328,72**, só conta corrente, o mesmo critério do Fluxo Bancário em 31/08. As aplicações e os resgates entram como operação: afetam só o caixa e nunca o resultado.
2. **Resultado e lucratividade por mês:** receita do Sponte e despesa da Análise de Despesas, com as taxas de cartão e as devoluções de cheques (R$ 37.510,21) somadas. A Divisão de Lucros fica fora do resultado e da lucratividade, mas reduz o saldo.
3. **Fechamento do saldo:** a diferença entre o saldo calculado e o saldo real de cada mês aparece como uma linha "Ajuste de caixa (aplicações, resgates, transferências e diferenças de baixa no Sponte)". Ela é só caixa. Assim o painel sai de R$ 328,72 e chega exatamente em R$ 81.619,16 em 31/08.
4. Antes de gravar, mostro a tabela mês a mês: receita, despesa, resultado, lucratividade, distribuição, ajuste e saldo.
5. **2025:** quando chegar o balancete do Sponte de 2025, repito o processo. Para isso, vou precisar dos extratos de dezembro/2024.

## Decisão: opção A (rápida)
- O ajuste de caixa é distribuído conforme a diferença de cada mês entre a planilha bancária revisada e o resultado. Janeiro e agosto fecham exatos; os meses do meio ficam aproximados.
- Depois, com os saldos de fim de mês de cada conta, refinamos para que cada mês feche no valor real.

## Detalhes técnicos
- Grava em `historical_monthly`, só de Rondonópolis, meses 2026-01 a 2026-08, com os tipos `receita`, `despesa`, `distribuicao de lucros` e `ajuste de caixa`. O ajuste é classificado como operação na SSOT (`tipoMeta`) e afeta só o Caixa.
- O saldo inicial de 01/01/2026 vai no mesmo lugar que o painel usa para o saldo de abertura, sem mudar o Fluxo Bancário, que continua começando em 31/08.

# Rondonópolis: saldo correto a partir da planilha do saldo inicial

## Sobre as transferências entre contas
- O balancete enviado não tem nenhuma linha de transferência. Ele só traz categorias de receita e despesa, e o "Total Geral" é receita menos despesa. Por isso, transferências não estão pesando nesse cálculo.
- Uma transferência entre contas próprias entra numa conta e sai de outra, e no total ela zera. Ela só daria um falso negativo se aparecesse de um lado só, o que não acontece nesse arquivo.
- O mais provável é que faltem **entradas** que não são receita: resgates de aplicação, empréstimos, aportes ou antecipações. Vou confirmar isso com a planilha que você vai mandar.

## Passos quando a planilha chegar
1. Ler o saldo da data informada (por conta, se vier separado) e confirmar se a planilha inclui transferências.
2. Calcular para frente, mês a mês: saldo anterior + receitas − despesas − distribuição de lucros.
3. Comparar com R$ 81.619,16 em 31/08/2026 e mostrar a diferença mês a mês, com a causa provável de cada uma (transferência de um lado só, aplicação/resgate, empréstimo).
4. Você aprova, e então eu gravo:
   - o histórico de receita e despesa de 01 a 08/2026, incluindo as taxas de cartão e as devoluções de cheques (R$ 37.510,21) se você confirmar;
   - a distribuição de lucros separada, fora do resultado e da lucratividade, mas reduzindo o saldo;
   - os saldos mensais, fechando em 31/08 com o mesmo valor do Fluxo Bancário.

## Detalhes técnicos
- `historical_monthly` só da escola Rondonópolis, meses 2026-01 a 2026-08; movimentos que não são receita nem despesa entram como operação (afetam só o Caixa, pela SSOT).
- Nada é gravado antes da sua aprovação da tabela de saldos.

# Rondonópolis: fechar o saldo de jan a ago/2026

## O que os números mostram
Testei três caminhos voltando de R$ 81.619,16 (31/08, valor confirmado):

| Caminho | Saldo em 01/01/2026 |
|---|---|
| Receitas do Sponte + despesas da plataforma | −529.807,47 |
| Histórico bancário (entradas − saídas) | −291.660,45 |
| Histórico bancário sem as entradas da Stone | +247.452,52 |

Nenhum dos três fecha. Os motivos já encontrados:

1. **As receitas do Sponte são maiores que o dinheiro que entrou no banco.** Em janeiro, o Sponte mostra R$ 393 mil e o banco R$ 288 mil, já contando a Stone. Isso pode vir de cartão lançado pelo valor bruto, de dinheiro recebido e não depositado, ou de baixas registradas fora da data. Por isso, as receitas do Sponte servem para o **resultado e a lucratividade**, mas não para calcular o saldo.
2. **A planilha do banco tirou as aplicações das saídas, mas deixou os resgates nas entradas.** No BB, o Rende Fácil (R$ 1,47 milhão no período) e a TED de R$ 200 mil do dia 27/08 saíram só das saídas. Se o resgate continua nas entradas, a entrada fica inflada. Agosto, por exemplo, mostra R$ 744 mil de entradas no BB.
3. **A Stone parece entrar duas vezes.** Os repasses da Stone para o BB foram tirados das saídas da Stone, mas continuam como entrada da Stone e de novo como entrada no BB.

## Proposta
- **Resultado e lucratividade (jan–ago):** receita do Sponte e despesa da Análise de Despesas, somando as taxas de cartão e as devoluções de cheques (R$ 37.510,21). A Divisão de Lucros fica fora do resultado. Isso pode ser gravado já.
- **Saldo:** usar o histórico bancário, com dois ajustes:
  - tirar das **entradas** os resgates do Rende Fácil, a TED de R$ 200 mil e os repasses da Stone para o BB, do mesmo jeito que já foi feito nas saídas;
  - partir do saldo bancário real de 31/12/2025 (BB + Sicredi + Stone + Rende Fácil) e calcular para frente até 31/08.
- A diferença entre o "caixa pelo banco" e o "resultado pelo Sponte" aparece mês a mês como **ajuste de caixa (operação)**. Ela afeta só o saldo, nunca o resultado, e assim o painel fecha exatamente em R$ 81.619,16.
- Mostro a tabela final para você aprovar antes de gravar.

## Preciso de você
- O saldo de cada conta em 31/12/2025, incluindo o saldo aplicado no Rende Fácil.
- O valor dos resgates do Rende Fácil por mês e se a TED de R$ 200 mil entrou em outra conta da escola. Se for mais fácil, mande os extratos e eu separo.

## Detalhes técnicos
- `historical_monthly` só de Rondonópolis, meses 2026-01 a 2026-08: `receita`, `despesa`, `distribuicao de lucros` e um tipo de operação para o ajuste de caixa, todos classificados pela SSOT (operação = só Caixa).
- Nada é gravado antes da sua aprovação.

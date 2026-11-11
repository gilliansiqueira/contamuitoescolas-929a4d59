# Ather: receitas por centro de custo (set/out)

## As planilhas resolvem?
Sim. Todas as linhas estão quitadas, têm data de pagamento e trazem um único centro de custo, e o valor do centro é igual ao valor recebido. Dá para gravar como as despesas, pela data de pagamento e por obra.

| Categoria | Set | Out | Como entra |
|---|---|---|---|
| Recebidos Obras | R$ 1.231.519,18 (12) | R$ 862.308,14 (8) | Receita da obra |
| Recebidos ATHER ENGENHARIA | — | R$ 4.325,00 (2) | Receita da estrutura |
| Reembolsos | R$ 770,20 (1) | R$ 3.906,51 (6) | Receita da obra indicada |
| Rendimentos de Aplicações | R$ 0,25 | R$ 0,14 | Receita da estrutura |
| Transferência entre Contas | R$ 4.115,83 | — | Fica fora (operação) |
| Entrada de Aporte | — | R$ 112.000,00 | Fica fora (operação) |
| Empréstimos | — | R$ 26.966,70 | Fica fora (operação) |

Nos meses anteriores, os centros de custo só tinham recebimentos de obra. Por isso transferência, aporte e empréstimo ficam fora: são entradas de caixa, não receitas, e se entrassem inflariam o resultado da estrutura.

**Total de receitas:** set **R$ 1.232.289,63** e out **R$ 870.539,79**.

## O que será feito
1. Apagar as receitas de set/out que estiverem nos centros de custo. Hoje não há nenhuma.
2. Gravar cada recebimento no centro de custo indicado, com data de pagamento e descrição "cliente · categoria". Cada linha terá origem rastreável, com o arquivo `ContaAzul_contas_recebidas_2026-09.xls` / `-10.xls`. Se um centro ainda não existir, ele é criado.
3. Conferir se a soma por mês bate com os totais acima.

Com isso, a Análise por obra passa a mostrar a margem de set/out. As despesas não mudam.

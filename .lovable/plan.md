# Diagnóstico: lançamentos que "somem" do Realizado (maio/2026 em diante)

Levantamento feito direto no banco, sem nenhuma alteração.

## 1. A hipótese do "editadoManualmente" não se confirma

- Existem apenas **94 lançamentos** com `editadoManualmente = true` a partir de 01/05/2026 (em 112.952 no período).
- Desses 94, **nenhum** cai na regra absoluta de fallback:
  - a grande maioria tem origem `contas_pagar`, `sponte` ou `cartao` — origens que, por regra, nunca passam pelas classificações do usuário e sempre entram pelo `tipo` nativo;
  - os poucos de origem `manual` usam "Rendimento" e "Despesa", ambos presentes no DEFAULT_MAPPINGS.
- Valor "sumindo" por causa do `editadoManualmente`: **R$ 0,00**.

## 2. O problema real: um único rótulo órfão — "Receita Real"

Analisando todos os lançamentos de origem `manual`/`fluxo`/`simulacao` de 01/05/2026 em diante, cruzando a chave efetiva (tipoOriginal → categoria → tipo) contra o DEFAULT_MAPPINGS e contra os itens do Modelo Financeiro de cada escola:

- **3.354 lançamentos órfãos**, somando **R$ 3.336.886,92**, resolvem hoje para `impactaCaixa=false` e `entraNoResultado=false`.
- São apenas **9 rótulos distintos** — ou seja, poucos valores órfãos repetidos, não uma variação grande:

| Rótulo (normalizado) | Tipo | Lançamentos | Valor |
|---|---|---|---|
| receita real | entrada | 3.199 | R$ 2.800.245,18 |
| distribuicao de lucros (dl) | saída | 73 | R$ 306.926,62 |
| emprestimo | saída | 23 | R$ 132.547,91 |
| entrada | entrada | 33 | R$ 44.990,90 |
| distribuicao de lucro | saída | 3 | R$ 27.826,70 |
| saque saida | saída | 16 | R$ 15.588,40 |
| aporte saida | saída | 3 | R$ 3.749,00 |
| aporte entrada | entrada | 3 | R$ 3.749,00 |
| compra escola | saída | 1 | R$ 1.263,21 |

Detalhe do caso dominante: são entries de **origem `fluxo`**, com `tipo_original = "Receita Real"` e `categoria = "fluxo_realizado"` — todas em escolas que **têm** Modelo Financeiro atribuído, mas cujo modelo não contém o item "Receita Real". Como "receita real" também não existe no DEFAULT_MAPPINGS, cai no fallback absoluto e o valor desaparece do Resultado e do Saldo.

## 3. Receita "sumindo" por empresa

Total de **receita (entrada)** perdida no período: **R$ 2.848.985,08** (3.235 lançamentos).

| Empresa | Lançamentos | Receita sumindo |
|---|---|---|
| Portão | 335 | R$ 414.225,73 |
| Cuiabá Jardim Itália | 248 | R$ 391.172,81 |
| Cuiabá Goiabeiras | 257 | R$ 346.227,36 |
| Rio Verde | 385 | R$ 325.968,68 |
| Pinheirinho | 259 | R$ 209.753,31 |
| Campo Largo | 361 | R$ 205.213,45 |
| Hauer | 323 | R$ 166.952,72 |
| Maracaju | 229 | R$ 152.037,75 |
| Bairro Alto | 180 | R$ 135.559,33 |
| Vitória | 76 | R$ 103.256,53 |
| Brasília | 181 | R$ 102.060,41 |
| São Chico | 193 | R$ 101.168,86 |
| Boa Vista | 96 | R$ 84.667,23 |
| São Mateus | 79 | R$ 65.730,01 |
| Influx Boa Vista | 33 | R$ 44.990,90 |

Considerando também as saídas órfãs (distribuição de lucros, empréstimo, saque, aporte, compra escola), o impacto total no caixa/resultado sobe para R$ 3.336.886,92, concentrado em: Cuiabá Jardim Itália (R$ 465.561,13), Portão (R$ 464.064,45), Cuiabá Goiabeiras (R$ 442.075,00), Rio Verde (R$ 370.349,12), Pinheirinho (R$ 225.582,61).

## 4. Observação complementar (Histórico Financeiro)

No `historical_monthly` a partir de 2026-05 também existem rótulos fora do padrão que dependem do modelo de cada escola para serem contabilizados, ex.: "cheques sicredi", "distribuicao de lucros - sicredi", "despesas outras unidades", "pagamentos em dinheiro", "receitas pf", "franqueadora", "compra de veiculo", "recebimentos em dinheiro". Não foram somados acima porque a validação depende do modelo por escola.

## Conclusão

Não é preciso mexer na lógica do `editadoManualmente`. O buraco é o **fallback absoluto silencioso** aplicado a 9 rótulos órfãos — sobretudo "Receita Real", gerado pelo próprio importador de Fluxo de Caixa Realizado.

Caminhos possíveis (nenhum aplicado ainda):
- adicionar esses rótulos ao DEFAULT_MAPPINGS (correção global, 1 arquivo);
- e/ou trocar o fallback absoluto por um fallback pelo `tipo` nativo em origem `fluxo`, com um alerta de "tipo não classificado" na tela, para nunca mais um valor sumir sem aviso.

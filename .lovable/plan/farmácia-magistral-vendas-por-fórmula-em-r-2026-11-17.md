# Farmácia Magistral: vendas por fórmula em R$

## O que muda
- Os 17 indicadores de vendas por tipo de fórmula (Cápsula, Creme, Loção... Pomada) passam a aparecer em **reais**, com o "R$" na frente, no lugar do "%".
  - Exemplo: Cápsula em out/2026 passa de "494.033,39%" para "R$ 494.033,39".
- Os valores gravados ficam iguais, de todos os meses. Só muda a forma de mostrar.
- O "Indefinido" fica como está: ele guarda quantidade, não valor.
- Os indicadores de CMV também não mudam (eles já estão em R$ e em %).

## Como confiro
- Abro a tela de Indicadores da farmácia e confiro os cartões e os gráficos em R$.

## Detalhes técnicos
- Atualizar só os dados: `kpi_definitions.value_type` de `percent` para `currency` nas definições da escola `60a80598-…`, deixando de fora 'Indefinido' e as de nome 'CMV%'.
- Não muda nenhuma tabela, nenhum cálculo e nenhum código.

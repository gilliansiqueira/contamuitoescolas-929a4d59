# Indicadores para a Ather Engenharia

Hoje a Ather não tem nenhum indicador. A Quintal de Casa usa 4: Margem Bruta, Margem Líquida, Ponto de Equilíbrio e Ticket Médio.

## Sugestão de indicadores

Financeiros (no modelo da Quintal):
- Margem Bruta (%) — receita menos custos diretos de obra/projeto
- Margem Líquida (%) — resultado do mês sobre a receita
- Ponto de Equilíbrio (R$) — faturamento mínimo para cobrir as despesas
- Lucratividade operacional automática (a mesma regra das escolas, calculada pelo sistema)

Próprios de engenharia:
- Faturamento médio por obra/contrato (equivale ao Ticket Médio)
- Custo de mão de obra sobre a receita (%)
- Custo de material sobre a receita (%)
- Carteira de contratos a receber (R$)
- Prazo médio de recebimento (dias)
- Inadimplência (%)
- Número de obras/projetos ativos no mês

## Como fica
- Cada indicador vira um cartão na aba Indicadores da Ather, com meta, cor por desempenho e ícone.
- Os que vêm do financeiro usam os mesmos números do Dashboard; os operacionais (obras ativas, carteira, prazo) são preenchidos pela equipe todo mês.
- Nada disso altera os cálculos financeiros.

## Detalhes técnicos
- Linhas em `kpi_definitions` (school_id da Ather) com `value_type` currency/percent/number e `direction`; valores em `kpi_values`; ícones em `kpi-icons`.
- Lucratividade via `auto_key` existente (`useAutoProfitability`).

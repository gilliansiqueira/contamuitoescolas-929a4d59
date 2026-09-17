# Planilha única com todos os dados da empresa São Carlos

Gerar um arquivo Excel (.xlsx) para download com todos os dados cadastrados da empresa "São carlos", cada conjunto de dados em uma aba separada da mesma planilha.

## Abas da planilha (somente as que têm dados)

| Aba | Origem | Registros |
|---|---|---|
| Lancamentos Projetados | financial_entries | 9.003 |
| Lancamentos Realizados | realized_entries | 4.416 |
| Plano de Contas | chart_of_accounts | 142 |
| Valores de Indicadores | kpi_values | 111 |
| Historico Mensal | historical_monthly | 103 |
| Vendas | sales_data | 67 |
| Conversoes | conversion_data | 40 |
| Recebiveis por Categoria | receivable_category_values | 32 |
| Historico de Uploads | upload_records | 20 |
| Definicoes de Indicadores | kpi_definitions | 7 |
| Prazos de Cobranca | payment_delay_rules | 5 |
| Faturamento Mensal | monthly_revenue | 3 |
| Ajustes de Simulacao | simulation_adjustments | 1 |

Tabelas sem registros para São Carlos (detalhamento de despesas, pedidos de análise de vendas, tetos de gastos, investimentos, notas de projeção, simulação) não geram aba.

## Como será feito

- Leitura paginada de cada tabela filtrada pela empresa (somente leitura, nada é alterado no sistema).
- Uma aba por tabela, com cabeçalho em negrito, colunas com largura ajustada e fonte Arial.
- Arquivo entregue como anexo para download: `sao_carlos_dados_completos.xlsx`.

## Detalhes técnicos

- Geração via Python (openpyxl) no sandbox, a partir de consultas paginadas ao banco.
- Datas mantidas como texto no formato original (YYYY-MM-DD) para não haver conversão incorreta.
- Nenhuma alteração no código do app nem no banco de dados.

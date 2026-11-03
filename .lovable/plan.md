# Rondonópolis — gravar histórico financeiro jan/2025 a ago/2026 (tudo)

## O que será gravado
- Receita mensal (balancete Sponte 2025 e jan–ago/2026).
- Despesa mensal (despesas da plataforma + taxas de cartão e devolução de cheques que faltavam: R$ 37.510,21 em 2026; R$ 45.113,28 + R$ 5.766,24 + R$ 22,16 em 2025).
- Distribuição de Lucros separada: fora do Resultado e da Lucratividade, mas reduzindo o saldo.
- Saldo mês a mês:
  - 2026: parte de R$ 328,72 (01/01/2026) e chega a R$ 81.619,16 (31/08/2026), com ajuste de caixa de −R$ 492.625,98 distribuído proporcional à receita.
  - 2025: gravado exatamente como na prévia (começa em −R$ 26.714,07 e fica negativo de ago a nov), sem ajuste por enquanto. Marcado como provisório: a hipótese é que a diferença venha das aplicações/resgates, a confirmar depois com extratos de investimento ou OFX.
- Lucratividade mensal (20 meses) nos Indicadores, substituindo só jan/2025–ago/2026.

## Garantias
- Nada fora de jan/2025–ago/2026 é tocado; setembro em diante segue o Fluxo Bancário.
- Ajuste de caixa lançado como Operação (só Caixa), com nome "Ajuste de caixa (aplicações, resgates, transferências e diferenças de baixa no Sponte)".
- Todos os registros com origem rastreável (um upload por planilha), para poder apagar e refazer quando chegarem os saldos reais.
- Conferência final: totais gravados = totais da prévia, saldo de 31/08/2026 = R$ 81.619,16, sem duplicidade com dados já existentes.

## Detalhes técnicos
- `historical_monthly` para receita/despesa/resultado/saldo; `kpi_values` do indicador Lucratividade.
- Lançamentos de ajuste e DL em `realized_entries` com `origem_upload_id`/`source_kind`/`source_file`/`imported_at` via `upload_records`.
- Remover antes apenas linhas do mesmo tipo/origem nesses meses para não duplicar.

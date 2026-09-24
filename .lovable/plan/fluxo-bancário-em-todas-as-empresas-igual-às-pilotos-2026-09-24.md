# Fluxo Bancário em todas as empresas (igual às pilotos)

## O que muda
- A aba **Operação → Fluxo Bancário** (subir extratos, contas, conciliação, classificação, conferência) passa a aparecer em **todas as empresas**, como já é em Dourados e nas Uberlândias. Hoje só 4 empresas têm a aba ligada, por isso não aparece no Bairro Alto.
- As 50 empresas que ficaram como "Rascunho" passam para **"Em conferência"**, igual às pilotos: o extrato é importado e conferido, mas **Dashboard e Fluxo Diário continuam lendo a planilha atual**.
- A troca para o Fluxo de Caixa no Dashboard/Fluxo Diário continua só pelo botão **Aprovar e ativar** na conferência de cada empresa, reversível com Pausar.
- Uberlândia Santa Mônica (já ativa) e as outras pilotos não mudam.
- Cliente continua sem ver a aba nesse primeiro momento (somente equipe/administradoras).

## O que não muda
- Nenhum lançamento existente é criado, alterado ou excluído; histórico antes de 01/09/2026 congelado.
- Análise de Despesas, relatórios e cálculos oficiais intocados.
- Empresa Demo e "teste 4" ficam de fora.

## Detalhes técnicos
- Inserir `school_features (feature_key='cashflow_bank_pilot', enabled=true)` para todas as escolas sem o registro (exceto demo/teste).
- `UPDATE school_data_sources SET status='em_conferencia' WHERE status='rascunho'`, mantendo `dashboard_source/daily_flow_source` na planilha e `start_month='2026-09'`.
- Sincronização continua sob demanda por empresa (idempotente), sem carga extra no carregamento das telas.
- Validar abrindo o Bairro Alto como admin e confirmando que a aba Fluxo Bancário e o upload de extratos aparecem.

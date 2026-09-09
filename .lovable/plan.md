# Análise de Despesas Detalhada (agrupamento configurável)

Nova aba que reaproveita a Análise de Despesas atual, mas com um nível extra de agrupamento configurável por empresa (Obras, Unidades, Projetos...). O relatório atual permanece intacto.

## Como vai funcionar

1. **Configurações > Detalhamento de Despesas** (visível para administradores):
   - liga/desliga a função para a empresa;
   - define o nome do detalhamento (ex.: "Obras");
   - cadastra, edita, reordena e desativa as opções (ex.: Sala, Banheiro, Loja).
2. **Lançamentos**: quando a função está ligada, os formulários de novo lançamento e de edição ganham um campo opcional "Obras" (nome conforme configurado) com as opções cadastradas.
3. **Nova aba** no Relatório Realizado, exibida como "Análise de Despesas — Obras", ativável/desativável como as demais abas. Estrutura idêntica à atual (filtros de mês, faturamento, cartões, gráficos, blocos), mas a primeira divisão passa a ser a opção de detalhamento; dentro de cada opção aparecem as categorias e seus lançamentos. Lançamentos sem detalhamento caem em um bloco "Sem detalhamento".
4. O mesmo lançamento continua único: aparece normalmente na Análise de Despesas atual e também na visão detalhada.

## Detalhes técnicos

**Banco (migration aditiva):**
- `expense_breakdown_settings`: `school_id` (único), `enabled` bool default false, `label` text default 'Detalhamento', timestamps. RLS por escola + GRANTs.
- `expense_breakdown_options`: `id`, `school_id`, `name`, `sort_order`, `active`, `created_at`. RLS por escola + GRANTs.
- `realized_entries`: nova coluna nullable `breakdown_id uuid` referenciando `expense_breakdown_options(id)` com `ON DELETE SET NULL`; índice `(school_id, breakdown_id)`.
- Regenerar os tipos gerados do backend.

**Frontend:**
- `src/hooks/useExpenseBreakdown.ts`: carrega settings + options da escola, expõe `{ enabled, label, options }`.
- `src/components/realizado/DetalhamentoConfig.tsx`: tela de configuração (toggle, nome, CRUD de opções); nova aba `detalhamento` em `configTabs` de `RealizadoModule.tsx`.
- `src/components/realizado/RelatorioRealizadoDetalhado.tsx`: cópia da lógica de `RelatorioRealizado.tsx` com o agrupamento primário trocado — mapa `breakdown_id -> opção`, cada bloco reusa `CategoryBlock` com as categorias internas; gráficos de barras e comparativo de faturamento passam a usar os totais por opção.
- `AddEntryDialog.tsx` / `EditEntryDialog.tsx`: campo `Select` opcional de detalhamento (só quando `enabled`), gravado em `breakdown_id`; mutações de insert/update em `RelatorioRealizado.tsx` passam o campo adiante.
- `RealizadoModule.tsx`: nova view `analise_detalhada` em `MainView`, `TabVisibility` e nos toggles de abas; botão só aparece quando a função está ligada, com rótulo `Análise de Despesas — {label}`; envolvido em `ExportPdfSection`.

O `RelatorioRealizado.tsx` atual não muda de comportamento — apenas ganha o campo extra opcional nos diálogos de lançamento.

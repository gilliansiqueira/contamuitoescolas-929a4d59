## Objetivo

Consolidar toda a lógica financeira em uma única SSOT, garantir que prazos de cobrança sejam aplicados em TODAS as telas, padronizar fontes de valor por tipo de importação, criar categoria independente "Sponte Pay", proibir lançamentos fantasmas e transformar a aba Dados em centro de auditoria com rastreabilidade completa.

## Fase 0 — Mapeamento (sem código)

Antes de qualquer alteração, gerar um relatório curto identificando:

1. Pontos de cálculo financeiro hoje:
   - `src/lib/classificationUtils.ts` (`calculateTotals`, `getSaldoImpact`)
   - `src/lib/tipoMeta.ts` + `src/lib/ledgerEngine.ts`
   - `src/lib/snapshotUtils.ts`
   - `src/components/Dashboard.tsx`, `CashFlow.tsx`, `DailyFlowTable.tsx`, `DataTable.tsx`, `FinancialCalendar.tsx`, `Receivables.tsx`, `ProjectedVsReal.tsx`, `ScenarioView.tsx`
2. Aplicação de prazos (`applyPaymentDelays`): hoje só em `DailyFlowTable.tsx` e `Dashboard.tsx`.
3. Categorização de recebíveis: hoje hardcoded em `Receivables.tsx::categorizeReceivable`.
4. Mapeamento de colunas na importação: `FileUpload.tsx` (alias prioritizado para `valor_com_desconto`).

Entregar o mapa antes de prosseguir.

## Fase 1 — SSOT central de projeção

Criar `src/lib/projectionEngine.ts` com:

- `applyPaymentDelay(entry, rules)` — função pura, única, recebe entry + regras e devolve a data ajustada (ISO).
- `projectEntries(entries, rules, classifications, model)` — pipeline canônico:
  1. filtra `isEntryIgnored`
  2. aplica gate do Modelo Financeiro (`useSchoolModel`)
  3. aplica `applyPaymentDelay` SOMENTE para `tipo_registro = 'projetado'` (realizado nunca desloca)
  4. retorna entries com `dataProjetada` e `impacto` (via `getSaldoImpact`)
- Hook `useProjectedEntries(schoolId)` que carrega entries + rules + classifications + model e devolve a lista canônica.

Substituir os usos atuais de `applyPaymentDelays` em `DailyFlowTable.tsx` e `Dashboard.tsx` pelo hook. Aplicar o mesmo hook em `Receivables.tsx`, `FinancialCalendar.tsx`, `CashFlow.tsx`, `DataTable.tsx`, `ScenarioView.tsx`, `ProjectedVsReal.tsx`.

## Fase 2 — Categoria independente "Sponte Pay"

- Em `src/lib/receivableCategorization.ts` (novo, extraído de `Receivables.tsx`): adicionar categoria `sponte_pay` antes de `boleto_cobranca`. Regra: `origem` contém `sponte pay` OU `categoria` contém `sponte pay`.
- Atualizar Dashboard, Fluxo, Recebíveis, Calendário, Dados, Relatórios para exibir a categoria como linha/coluna separada.
- Migration: inserir `receivable_categories` `Sponte Pay` para escolas existentes (sort_order entre PIX e Boleto).

## Fase 3 — Fonte de valor por importação

Em `src/components/FileUpload.tsx` (e parsers correlatos):

- **Cartões (Maquininha)**: usar EXCLUSIVAMENTE coluna `Valor Líquido` / `valor_liquido`. Remover fallbacks para `valor_com_desconto`, `valor`, `total`, `valor_bruto`.
- **Cheques**: EXCLUSIVAMENTE `ValorComDesconto`.
- **Sponte (Recebimentos)**: EXCLUSIVAMENTE `ValorComDesconto`.
- Se a coluna obrigatória não existir → falhar a importação com mensagem explícita (sem fallback silencioso).

## Fase 4 — Proibição de lançamentos fantasmas + rastreabilidade

Migration em `financial_entries`:

```sql
ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'manual'
    CHECK (source_kind IN ('import','manual','manual_edit')),
  ADD COLUMN IF NOT EXISTS source_file text,
  ADD COLUMN IF NOT EXISTS import_batch_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE INDEX IF NOT EXISTS idx_fe_import_batch ON public.financial_entries(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_fe_source_kind ON public.financial_entries(source_kind);
```

Criar tabela `import_batches` (id, school_id, source_kind, file_name, uploaded_at, uploaded_by, row_count, total_value) com GRANTs + RLS.

Atualizar:
- `FileUpload.tsx` e demais importadores → gravam `source_kind='import'`, `source_file`, `import_batch_id`, `created_by`.
- Diálogos de inclusão/edição manual → gravam `source_kind='manual'` / `'manual_edit'`, `created_by`.

Auditoria de coerência: criar `src/lib/auditConsistency.ts` com `assertSumMatches(displayed, entries)` usado em dev (console.warn em prod) para validar `soma === total exibido`.

Remover qualquer ponto que crie entries sintéticas (verificar `Simulation.tsx`, `ScenarioView.tsx`, snapshots) — projeções de cenário devem ser cálculo de exibição, nunca insert no banco.

## Fase 5 — Aba Dados como Centro de Auditoria

Refatorar `src/components/DataTable.tsx`:

- Barra de filtros:
  - Origem (`source_kind` + `origem`)
  - Arquivo de origem (`source_file`, autocompletar a partir de `import_batches`)
  - Tipo de inclusão (Importado / Manual / Todos)
  - Lote (`import_batch_id`, dropdown)
  - Período (existente)
- Colunas visíveis: Origem, Arquivo, Lote, Data Upload, Usuário, Data Original, Data Projetada (via SSOT), Tipo (Importado/Manual badge), Valor Original (`valor` no momento da importação — adicionar `valor_original numeric`), Valor Atual, Status (`tipo_registro`).
- Drawer "Lotes de Importação" listando registros de `import_batches` com totais; clique abre lista filtrada.
- Badge visual "Manual" para `source_kind != 'import'`.

## Fase 6 — Validação

- Testes em `src/test/projectionEngine.test.ts` cobrindo: aplicação de prazo, ignorar, transferência, modelo, soma === exibição.
- Smoke manual em Rio Verde e Campo Largo.
- Auditoria: para 5 dias aleatórios, abrir Calendário e Dados filtrados pelo mesmo dia → totais idênticos.

## Detalhes técnicos

- Não tocar em `src/integrations/supabase/{client,types}.ts`.
- Toda alteração de schema via `supabase--migration` com GRANTs.
- Manter `useSchoolModel` e `tipoMeta` atuais; o engine novo os consome.
- Cenários e Simulação permanecem apenas em memória (sem inserts no banco).

## Ordem de execução

1. Fase 0 (relatório) → pausa para confirmação
2. Fases 1 + 2 (engine + Sponte Pay)
3. Fase 3 (colunas)
4. Fase 4 (migration + rastreabilidade)
5. Fase 5 (UI Dados)
6. Fase 6 (validação)

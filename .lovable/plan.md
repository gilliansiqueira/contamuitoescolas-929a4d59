## Objetivo

Garantir integridade absoluta dos dados financeiros: **Dados = SSOT única**. Toda tela (Dashboard, Fluxo Diário, Fluxo, Previsto x Realizado) deve consumir exatamente o mesmo conjunto que aparece em Dados — sem cálculos paralelos, sem registros fantasmas, sem duplicações, sem perdas, com rastreabilidade completa por upload.

## Fase 0 — Diagnóstico (sem código)

Antes de qualquer alteração, executar leituras no banco e mapeamento de código para entregar relatório com:

1. **Duplicações** — query agrupando `financial_entries` por `(school_id, data, descricao, valor, origem)` com `count > 1`, para cada escola. Identificar se há `origem_upload_id` diferente (re-upload) ou igual (bug na importação).
2. **Órfãos** — entries com `origem_upload_id` apontando para upload inexistente, ou entries sem `origem_upload_id` que deveriam ter (origem ≠ 'manual').
3. **Meses inválidos** — varredura em `historical_monthly`, `kpi_values`, `monthly_revenue`, `conversion_data`, `receivable_category_values`, `investment_entries`, `period_closures` para qualquer `month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`.
4. **Mapa de queries por tela** — confirmar que Dashboard / DailyFlowTable / CashFlow / ProjectedVsReal / DataTable consomem todos `useProjectedEntries(schoolId)` (SSOT). Listar qualquer ponto que ainda use `useEntriesFromBaseDate`, `entry.tipo === 'entrada'` para somar, ou heurística "positivo=receita".
5. **Aba Dados (DataTable)** — verificar se aplica os mesmos filtros (modelo + prazo) que as demais. Se aplicar filtros diferentes, é a causa da divergência.

Entregar o relatório antes de prosseguir para a Fase 1.

## Fase 1 — Causa raiz das duplicações e da exclusão de upload

1. **Importação idempotente** (`FileUpload.tsx` + parsers):
   - Antes de inserir, deduplica em memória por `(data, descricao, valor, tipo_original)` dentro do mesmo lote.
   - Insere com `origem_upload_id` sempre preenchido.
2. **Constraint de banco** — migration adicionando índice único parcial:
   ```sql
   CREATE UNIQUE INDEX uq_fe_dedupe
     ON public.financial_entries (school_id, data, descricao, valor, origem, COALESCE(tipo_original,''))
     WHERE origem <> 'manual';
   ```
   Importadores passam a usar `upsert` com `onConflict` para tolerar re-importação sem duplicar.
3. **Exclusão de upload com cascata real** — `uploads` (ou tabela equivalente) hoje não força remoção dos entries. Corrigir o handler de exclusão em `UploadHistory.tsx` / `HistoricoUploads.tsx` para executar:
   ```ts
   await supabase.from('financial_entries').delete().eq('origem_upload_id', uploadId);
   await supabase.from('uploads').delete().eq('id', uploadId);
   ```
   em transação lógica (delete entries primeiro). Adicionar verificação de órfãos via query de manutenção.
4. **Limpeza one-shot** — migration de dados para:
   - Apagar duplicatas atuais mantendo o registro mais antigo por `(school_id, data, descricao, valor, origem, tipo_original)`.
   - Apagar entries com `origem_upload_id` órfão.

## Fase 2 — SSOT única em todas as telas

1. Substituir qualquer uso direto de `useEntriesFromBaseDate` em Dashboard / CashFlow / DailyFlowTable / ProjectedVsReal / DataTable / FinancialCalendar / Receivables por `useProjectedEntries(schoolId)`.
2. **DataTable** passa a listar exatamente `entries` retornados pela SSOT, exibindo `dataProjetada`, `impacto`, `origem_upload_id` e arquivo de origem. Sem filtros próprios além de período/origem.
3. Banir literais `entry.tipo === 'entrada' ? +valor : -valor` em todo o código. Tudo passa por `getSaldoImpact` / `calculateTotals` (já SSOT em `classificationUtils`).
4. Adicionar teste em `src/test/ssot.test.ts`: dado um conjunto de entries, soma do Dashboard === soma do DataTable === soma do CashFlow para o mesmo período.

## Fase 3 — Rastreabilidade completa

Migration em `financial_entries`:

```sql
ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'manual'
    CHECK (source_kind IN ('import','manual','manual_edit')),
  ADD COLUMN IF NOT EXISTS source_file text,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid;
CREATE INDEX IF NOT EXISTS idx_fe_origem_upload ON public.financial_entries(origem_upload_id);
```

- Importadores gravam `source_kind='import'`, `source_file`, `imported_at`, `origem_upload_id`, `created_by`.
- Diálogos de inclusão/edição manual gravam `source_kind='manual'` / `'manual_edit'`.
- DataTable mostra coluna "Origem do upload" (arquivo + data + usuário) e badge "Manual".

## Fase 4 — Validação de formato de mês + cleanup Rio Verde

- Confirmar que CHECK `month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'` está ativo nas 7 tabelas (já existe segundo memória). Se faltar, adicionar.
- Migration de dados para Rio Verde: localizar registros com mês inválido (`20251-01`, `20252-01`, `202510-01`) e:
  - Tentar correção determinística (`20251-01` → `2025-01`) quando inequívoco.
  - Apagar os ambíguos com log.
- Validação no front (`HistoricoFinanceiroConfig`) já bloqueia; reforçar mensagem.

## Fase 5 — Conferência de importação

Em cada importador:
- Contar `linhas_planilha`, `linhas_gravadas`, `linhas_descartadas` (com motivo).
- Gravar resumo em tabela `import_audits` (nova) ou no próprio registro de upload.
- Exibir toast e linha em "Histórico de Uploads" com o totalizador. Falha se `gravadas + descartadas ≠ planilha`.

## Fase 6 — Relatório final

Após implementação, executar novamente as queries da Fase 0 e entregar:
1. Onde estava a duplicação + correção.
2. Onde estava a perda.
3. Órfãos encontrados e removidos.
4. Fantasmas removidos pela cascata.
5. Pontos fora da SSOT corrigidos.
6. Mapa tabela → tela.
7. Causa raiz de cada problema.
8. Lista de migrations / arquivos alterados.

## Detalhes técnicos

- Não tocar em `src/integrations/supabase/{client,types}.ts`.
- Toda alteração de schema via `supabase--migration` com GRANTs.
- Toda limpeza de dados via `supabase--insert` (DELETE/UPDATE).
- Manter SSOT já existente (`projectionEngine`, `ledgerEngine`, `classificationUtils`, `tipoMeta`). O trabalho é ELIMINAR desvios, não criar nova camada.
- Cenários e Simulação continuam apenas em memória — nunca inserem no banco.

## Ordem de execução

1. Fase 0 (diagnóstico) → pausa para revisão dos achados
2. Fase 1 (dedupe + cascata de upload)
3. Fase 2 (SSOT em todas as telas)
4. Fase 3 (rastreabilidade)
5. Fase 4 (formato de mês + Rio Verde)
6. Fase 5 (conferência de importação)
7. Fase 6 (relatório final)

# Refatoração: Templates como única SSOT financeira

## Escopo confirmado
- Aplica-se **apenas ao Relatório Realizado / Dashboard / DRE / Fluxo Diário / Fluxo de Caixa / Histórico / Projeção derivada desses dados**.
- **NÃO se aplica** a entries com `origem ∈ {sponte, cheque, cartao, contas_pagar}` — esses continuam usando o `tipo` nativo do upload (regra já existente em `ORIGENS_SEMPRE_CLASSIFICADAS`).
- Eliminar `type_classifications` como fonte de decisão. Templates (`financial_model_template_items`) passam a ser a única SSOT com dois campos-chave: `entra_no_resultado` e `impacta_caixa` (= "entra_no_saldo").

## Modelo final de decisão

Para cada entry elegível (origens `fluxo`, `manual`, `historico`, `simulacao`):

1. Chave de lookup = `normalizeTipo(entry.tipoOriginal || entry.categoria || entry.tipo)`.
2. Busca no template da escola (`fetchSchoolTemplateId` → `fetchTemplateItems`) pelo mesmo `normalizeTipo(item.name)`.
3. Regras:
   - `entra_no_resultado=true` + `tipo='entrada'` → **receita**
   - `entra_no_resultado=true` + `tipo='saida'` → **despesa**
   - `entra_no_resultado=false` + `impacta_caixa=true` → **operação** (sinal pelo `tipo`)
   - ambos false ou `tipo='ignorar'` → **ignorar**
4. **Sem match no template** → fallback pelo `entry.tipo` nativo (entrada=receita+, saida=despesa−), preservando comportamento atual e evitando quebra durante transição.

## Fases

### Fase 1 — Novo motor central (Templates SSOT)
- `src/lib/templateRules.ts` (novo): `resolveTemplateRule(key, items)`, `getEntrySaldoImpact(entry, items)`, `isEntryIgnored`, `filterActiveEntries`, `calculateTotals`, `getEffectiveClassification`. Assinatura espelha `classificationUtils` para migração 1:1.
- `src/hooks/useSchoolTemplateItems.ts` (novo): retorna `FinancialModelTemplateItem[]` já cacheados por escola (baseado em `useSchoolModel`).

### Fase 2 — Migrar consumidores
Substituir `useTypeClassifications` → `useSchoolTemplateItems` e `classificationUtils` → `templateRules` em:
- Hooks: `usePeriodMovementCtx`, `usePeriodSnapshots`, `useSaldoInicialPeriodo`, `useProjectedEntries`, `usePeriodClosures`.
- Libs: `periodMovement`, `snapshotUtils`, `projectionEngine`, `closureValidation`, `modelValidation`, `ledgerEngine`, `tipoMeta`.
- Componentes: `Dashboard`, `DailyFlowTable`, `CashFlow`, `FinancialCalendar`, `DataTable`, `ProjectedVsReal`, `Receivables`, `Simulation`, `HistoricoFinanceiroConfig`, `FileUpload`, `upload/TipoMappingStep`.
- Testes: `ledgerEngine.test`, `periodMovement.test` (adaptar mocks para template items).

Regra de isolamento das origens de upload preservada dentro do novo motor (mesma constante `ORIGENS_SEMPRE_CLASSIFICADAS`).

### Fase 3 — Remoção da Classificação de Tipos
- Deletar: `src/components/TypeClassificationConfig.tsx`, `src/lib/classificationUtils.ts` (ou reduzir a stub re-exportando de `templateRules` para não quebrar imports esquecidos — decidir na hora), `useTypeClassifications` em `useFinancialData`.
- Remover aba/rota da tela em `pages/Index.tsx` e onde for referenciada.
- Migration Supabase: `DROP TABLE public.type_classifications CASCADE` + remover triggers/guards/functions que a referenciem (validar antes com `pg_depend`).
- Ajustar `financialModels.applyTemplateToSchool` para deixar de escrever em `type_classifications` (só grava `financial_model_template_id`).

### Fase 4 — Auditoria final
- `rg` por `type_classifications|TypeClassification|useTypeClassifications|classificationUtils` deve retornar 0 hits fora dos arquivos gerados.
- Rodar `bunx vitest run` e conferir Dashboard/Fluxo/DRE de uma escola real via Playwright para checar paridade de saldo antes/depois.

## Riscos & mitigação
- **Escolas sem template atribuído**: fallback do passo 4 mantém sistema funcional; sinal manual do usuário anterior (`operacao_sinal`) é perdido — aviso no changelog. Se identificarmos escolas assim, oferecemos migração automática (converter `type_classifications` existentes em itens de template privado antes do DROP).
- **DROP CASCADE**: antes de aprovar a migration final, listar dependências e migrar dados críticos para itens de template.

## Detalhes técnicos
- `FinancialModelTemplateItem.tipo` já cobre `entrada|saida|ignorar` e possui `impacta_caixa` + `entra_no_resultado` — modelo suficiente, sem mudança de schema nos templates.
- `type_classifications.operacao_sinal` (auto|somar|subtrair): não há equivalente em template. Proposta: quando `tipo='saida'` + `impacta_caixa=true` + `entra_no_resultado=false`, sinal = subtrair; quando `tipo='entrada'` idem, sinal = somar. Cobre 100% dos casos observados; casos "auto" viram fixo pelo `tipo` do item.
- Manter `ORIGENS_SEMPRE_CLASSIFICADAS = {sponte, cheque, cartao, contas_pagar}` como bypass — projeções desses uploads continuam intactas.

Entrega prevista em uma sequência: Fase 1+2 num commit (sistema funcional com Templates SSOT, tela antiga ainda visível mas ignorada), depois aprovação sua para Fase 3 (remoção + migration DROP).
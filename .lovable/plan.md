
## 1. Dashboard — Projetado e Realizado coexistem

**Bug atual** (`src/components/Dashboard.tsx`): quando o mês tem upload de Fluxo, `monthSources[m] = 'upload'` e o agregador ignora qualquer entry cuja `origem !== 'fluxo'`. Resultado: Sponte/Cheque/Cartão/Contas a Pagar somem do Dashboard, e lançamentos manuais (`origem='manual'`) também.

**Correção**:
- Nova fonte `'misto'` em `monthSources`: quando o mês tem `upload` E também tem entries projetadas (`tipoRegistro='projetado'`) ou manuais.
- No agregador `tipoAggregations`, `monthlyChart`, `topExpenseCategories` e `annualLineChart`: para `src === 'upload'` ou `'misto'`, somar:
  - **Realizado**: entries com `origem='fluxo'` OU (`origem='manual'` AND `tipoRegistro='realizado'`).
  - **Projetado**: entries com `tipoRegistro='projetado'` (qualquer origem) cuja data >= hoje OU não tenham equivalente em fluxo.
- O painel "Realizado vs Projetado" continua usando `tipoRegistro` — passa a incluir manuais.
- **Saldo Final do período**: `saldo_inicial + realizado_até_hoje + projetado_após_hoje`. Cards passam a mostrar três valores: **Realizado**, **Projetado restante**, **Saldo Final estimado**.

## 2. Investimentos — múltiplos cards por mês

**Schema atual**: `investment_entries` tem `UNIQUE(school_id, month)` — só 1 registro por mês.

**Migração**:
- Remover constraint `UNIQUE(school_id, month)`.
- Adicionar coluna `nome TEXT NOT NULL DEFAULT 'Investimento'` para identificar cada card.
- Adicionar `sort_order INTEGER DEFAULT 0`.

**UI** (`src/components/InvestimentoSection.tsx`):
- Lista cada card como bloco editável com **nome**, 7 campos, botão **Duplicar** e **Remover**.
- Botão **+ Adicionar investimento** (cria novo registro com nome editável).
- Tabela agregada continua somando todos os cards do mês.
- Comportamento atual de cálculo preservado.

## 3. Lançamentos manuais — impactam Dashboard

**Bug**: manuais (`origem='manual'`) são salvos com `tipoRegistro = determineTipoRegistro(data)` mas o Dashboard os filtra junto com as projeções quando o mês tem upload (item 1).

**Correção**:
- Coberta pela mudança em #1 — manuais passam a ser sempre incluídos:
  - Manuais com `tipoRegistro='realizado'` somam ao Realizado mesmo em meses com upload.
  - Manuais com `tipoRegistro='projetado'` somam ao Projetado.
- `getEffectiveClassification` em `classificationUtils.ts` já trata `origem='manual'` via `tipo` (entrada/saída) → mapeia para receita/despesa.

## 4. Consolidação automática ao subir Fluxo de Caixa

**Hoje**: `historical_monthly` só é alimentado no fechamento do mês.

**Correção** em `src/components/FileUpload.tsx → handleConfirm` (somente quando `selectedType.key === 'fluxo'`):
- Após inserir entries, identificar os meses únicos do upload.
- Para cada mês:
  - Se está fechado em `period_closures` → **pular** (não recalcula meses fechados).
  - Senão: agregar entries de `origem='fluxo'` (somando manuais realizados) por classificação efetiva e fazer **upsert em `historical_monthly`** com `onConflict: 'school_id,month,tipo_valor'` para `tipo_valor='Receita'` e `'Despesa'` (e operações se houver).
- Auditoria: registra "Consolidou histórico financeiro de {N} mês(es)".

## Arquivos afetados

- `src/components/Dashboard.tsx` — nova fonte `'misto'`, lógica de coexistência projetado/realizado, novos KPIs.
- `src/components/InvestimentoSection.tsx` — múltiplos cards (add/duplicar/remover/nome).
- `src/components/FileUpload.tsx` — consolidação automática pós-upload de Fluxo.
- Migração: `investment_entries` (drop unique, +nome, +sort_order).

## O que NÃO muda

- Estrutura de `financial_entries` / `realized_entries` / `period_closures`.
- Lógica de classificação por tipo.
- Lógica de fechamento de mês (snapshot já existente continua igual).
- Lançamentos manuais (preserva flag `editado_manualmente`).
- Substituição de projeção por origem (já feita).
- RLS / autenticação / roles.

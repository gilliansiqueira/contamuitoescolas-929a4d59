## Objetivo

Tornar a aba **Dados** a única fonte da verdade. Antes de qualquer nova funcionalidade, encontrar e corrigir TODAS as violações das 10 regras, com relatório de causa raiz, registros afetados, telas afetadas e correção aplicada.

## Fase A — Auditoria (somente leitura, sem código)

### A.1 Inventário de fontes por tela
Mapear via leitura de código qual hook/query alimenta:
- DataTable (Dados) · Dashboard · DailyFlowTable · CashFlow · ProjectedVsReal · Receivables

Confirmar uso único de `useProjectedEntries(schoolId)` como base. Listar qualquer divergência.

### A.2 Conciliação numérica — CRITÉRIO DE APROVAÇÃO

**A Fase A só é concluída quando, para cada `school_id` e cada um dos últimos 6 meses, for apresentada uma matriz numérica real demonstrando Δ = 0** (ou, se Δ ≠ 0, causa raiz formal identificada).

Para CADA escola/mês, apresentar tabela com:

| Métrica | Valor encontrado | Valor esperado (Dados) | Δ | IDs que compõem | Query/função |
|---|---|---|---|---|---|
| Receita — Dados | ... | ... | 0 | array de ids | SQL |
| Receita — Dashboard | ... | (Dados) | ... | ids consumidos | hook + filtro |
| Receita — Fluxo Diário | ... | (Dados) | ... | ids | hook + filtro |
| Receita — Fluxo de Caixa | ... | (Dados) | ... | ids | hook + filtro |
| Receita — Previsto×Realizado | ... | (Dados) | ... | ids | hook + filtro |
| Despesa — Dados | ... | ... | 0 | ids | SQL |
| Despesa — Dashboard | ... | (Dados) | ... | ids | hook + filtro |
| Despesa — Fluxo Diário | ... | (Dados) | ... | ids | hook + filtro |
| Despesa — Fluxo de Caixa | ... | (Dados) | ... | ids | hook + filtro |
| Despesa — Previsto×Realizado | ... | (Dados) | ... | ids | hook + filtro |
| Saldo final do mês N | ... | — | — | — | função |
| Saldo inicial do mês N+1 | ... | saldo final N | Δ | — | função |

**Regras de entrega**:
- Toda linha deve trazer (valor encontrado, valor esperado, Δ, lista de ids, query/função usada).
- Para telas, reproduzir EXATAMENTE a cadeia da tela: `useProjectedEntries` → filtros (período, modelo, prazo, classificação) → `calculateTotals` — replicar isso em SQL/script equivalente para obter o número.
- Proibido entregar conclusões genéricas tipo "SSOT validada", "arquitetura correta", "todas as telas usam a mesma lógica". Só números do banco contam.

**Quando Δ ≠ 0**:
1. Listar os ids exatos que entram em uma soma e não na outra (`array_diff`).
2. Apontar a tela afetada.
3. Apontar a função/query responsável (linha do código).
4. Explicar a causa raiz (filtro extra, heurística sinal, snapshot defasado, cache, etc.).

### A.3 Registros fantasmas / órfãos
```sql
-- entries com upload_id apontando para upload inexistente
SELECT fe.* FROM financial_entries fe
LEFT JOIN upload_records ur ON ur.id = fe.origem_upload_id
WHERE fe.origem_upload_id IS NOT NULL AND ur.id IS NULL;

-- entries de origens de upload sem upload_id
SELECT * FROM financial_entries
WHERE origem IN ('sponte','cheque','cartao','contas_pagar')
  AND origem_upload_id IS NULL;

-- realized_entries sem origem_arquivo
SELECT * FROM realized_entries WHERE COALESCE(origem_arquivo,'') = '';
```

### A.4 Duplicidades
```sql
SELECT school_id, data, descricao, valor, origem, COUNT(*), array_agg(id)
FROM financial_entries
GROUP BY 1,2,3,4,5 HAVING COUNT(*) > 1;
```

### A.5 Heurísticas proibidas no código
- `rg "tipo === 'entrada'"` / `"tipo === 'saida'"` usadas para SOMAR
- `rg "valor > 0 \\? 'receita'"` ou similares
- `rg "Math.abs\\(.*valor"` em agregações
- Qualquer mapeamento por nome de categoria fora de `tipoMeta` / `classificationUtils`

### A.6 Rastreabilidade
% de entries não-manuais com `source_kind`, `source_file`, `imported_at`, `origem_upload_id` preenchidos. Listar lacunas por escola.

### A.7 Cascata de exclusão de upload
- Projeção: validar FK `financial_entries.origem_upload_id → upload_records.id ON DELETE CASCADE`.
- Realizado: `HistoricoUploads.tsx` hoje deleta por `origem_arquivo`. Verificar se sobram órfãos quando o mesmo arquivo é importado em datas diferentes.

**PAUSA OBRIGATÓRIA** ao final da Fase A: entregar a matriz numérica completa. Sem ela, Fase B não inicia.

## Fase B — Correções estruturais (após Δ ≠ 0 ser identificado)

Aplicadas APENAS para violações reais encontradas na Fase A:

1. **SSOT única**: substituir qualquer fonte paralela por `useProjectedEntries`. DataTable lista exatamente o mesmo conjunto.
2. **Banir sinal/entrada-saída** como autoridade: tudo via `getSaldoImpact` / `calculateTotals`. Teste que falha se encontrar `tipo === 'entrada' ? +v : -v` em código de soma.
3. **Cascata de exclusão**: garantir FK CASCADE em projeção; para realizado, migrar de `origem_arquivo` para `origem_upload_id` com FK CASCADE (criar `realized_uploads` se necessário).
4. **Rastreabilidade obrigatória**: CHECK que exige `origem_upload_id NOT NULL` quando `origem IN ('sponte','cheque','cartao','contas_pagar')`. Backfill antes.
5. **Dedupe**: índice único parcial `(school_id, data, descricao, valor, origem, COALESCE(tipo_original,''))` WHERE origem ≠ 'manual'. Migration de limpeza mantendo o mais antigo.
6. **Saldo encadeado**: teste automatizado `saldo_final(N) === saldo_inicial(N+1)` para todas as escolas e meses com dados.
7. **Teste de conciliação** (`src/test/ssot.test.ts`): Σ por tela === Σ Dados, para mesmo período.

## Fase C — Relatório final

Re-executar a matriz da Fase A.2 demonstrando Δ = 0 em todas as escolas/meses, com:
1. Causa raiz de cada divergência corrigida
2. Registros afetados (ids + escola + mês)
3. Telas afetadas
4. Correção aplicada (migration / arquivo / linha)
5. Matriz pós-correção

## Detalhes técnicos

- Nenhuma funcionalidade nova enquanto existir Δ ≠ 0 sem causa raiz formal.
- Schema via `supabase--migration`; dados via `supabase--insert`.
- SSOT (`projectionEngine`, `ledgerEngine`, `classificationUtils`, `tipoMeta`) é mantida — o trabalho é eliminar desvios.
- Cenários e Simulação seguem só em memória.

## Ordem

1. Fase A (auditoria com matriz numérica) → **PAUSA** até Δ = 0 ou causa raiz formal
2. Fase B (correções) — só do que a Fase A apontar
3. Fase C (relatório final com matriz pós-correção)

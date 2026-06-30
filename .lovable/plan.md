## Objetivo

Refatorar o fluxo de importação de recebimentos (Sponte) para impedir gravações silenciosas. Toda importação passa por **conferência → simulação de delay → simulação de substituição → auditoria** antes de gravar. Cada lançamento fica rastreável até a linha do arquivo original.

---

## 1. Banco de dados (migration)

**Novos campos em `financial_entries`** (rastreabilidade — Regra de Ouro):
- `upload_id uuid` — FK para `upload_records`
- `source_file text` — nome do arquivo
- `imported_at timestamptz`
- `data_original date` — vencimento antes do delay
- `delay_rule_applied jsonb` — `{ days, weekend_adjustment, source_method }`
- `payment_method_key text` — normalizado (boleto, pix, credito, debito, cheque, dinheiro, sponte_pay)

**Nova tabela `import_audits`** (histórico de cada conferência):
- `school_id`, `upload_id`, `created_by`, `summary jsonb` (totais arquivo × sistema por método, diferenças, ações tomadas), `approved boolean`

Migration cria GRANT/RLS padrão (authenticated CRUD na própria escola, service_role total).

---

## 2. Engine de importação (TypeScript puro, testável)

Arquivo novo `src/lib/import/sponteAuditEngine.ts`:

- `parseSponteFile(file) → ParsedEntry[]` — extrai linhas + método normalizado
- `buildConferenceReport(parsed, existingEntries, schoolId)` → tabela por método:
  ```
  { method, arquivo, sistema, diferenca, registros_arquivo, registros_sistema }
  ```
- `simulateDelays(parsed, rules)` → `{ antes: ByMonth, depois: ByMonth, movimentacoes: Movement[] }`
  - Regra fim-de-semana: sáb/dom → próxima segunda (reusa `addDaysAndAdjust`)
  - Cartão de Débito **nunca** usa regra de Crédito (validação dura: bloqueia se mapeamento estiver errado)
- `simulateReplacement(parsed, existing, filter: {origem, categoria, periodo})` → `{ remover: {count, valor}, inserir: {count, valor}, saldo_esperado }`
- `runPostImportAudit(arquivo, sistema)` → diferenças por método, total geral, qtd registros
- `explainDifferences(diffs, contexto)` → IA (Lovable AI Gateway, `google/gemini-3-flash-preview`) recebe diffs + amostra de registros e devolve causas possíveis (duplicação, delay duplo, fim-de-semana, upload anterior ativo, categoria errada, etc.)

Testes unitários em `src/test/sponteAuditEngine.test.ts` cobrindo: fim-de-semana, crédito vs débito, substituição determinística, delay duplicado.

---

## 3. Edge Function `audit-import-differences`

Recebe `{ schoolId, diffs, sample }`, monta prompt e chama Lovable AI Gateway. Retorna lista estruturada de causas possíveis com valores. Mantém `LOVABLE_API_KEY` server-side.

---

## 4. UI — Wizard de 4 etapas

Novo componente `src/components/realizado/ImportacaoSponteAuditada.tsx` substitui o fluxo atual do upload Sponte (mantém o componente antigo como fallback para outros tipos).

**Etapas:**

1. **Upload** — arquivo + opções (substituir a partir de data, escopo: origem/categoria/período)
2. **Conferência por método** — tabela arquivo × sistema × diferença (com badge verde/vermelho). Botão **Aprovar conferência** habilitado só quando diferenças explicadas ou zero.
3. **Simulação de delay** — duas colunas (antes/depois) por mês e método. Aprovar movimentação.
4. **Simulação de substituição** — prévia de remoções e inserções com saldo esperado. Bloqueia se saldo ≠ 0 a menos que usuário confirme override (admin).
5. **Auditoria final + IA** — após gravação, mostra relatório com diferenças residuais e análise da IA. Grava em `import_audits`.

Cada etapa permite voltar; nada é gravado até a etapa final.

---

## 5. Mapeamento estrito de métodos

`src/lib/import/methodMapping.ts`:
- `CREDITO`: "Cartão de Crédito", "Cartão Crédito", "Cred", "Credito" → `credito` (delay aplicável)
- `DEBITO`: "Cartão de Débito", "Debito", "Deb" → `debito` (**nunca** delay de crédito)
- `SPONTE_PAY`: "Sponte Pay", "SpontePay", "Boleto Sponte Pay" → `sponte_pay`
- `BOLETO`, `PIX`, `CHEQUE`, `DINHEIRO` — match exato/alias
- Linha não mapeada → erro bloqueante na etapa 1

---

## 6. Rastreabilidade no Dashboard

Adicionar drill-down em qualquer card de recebimento: clicar → modal com tabela de `financial_entries` filtrados, mostrando `source_file`, `upload_id`, `data_original`, `data` (após delay), `delay_rule_applied`. Reusa o componente DataTable.

---

## Detalhes técnicos

- **Não altera** `projectionEngine.ts` nem `useProjectedEntries.ts` (SSOT mantida). Os novos campos viajam junto com o `ProjectedEntry`.
- **Substituição determinística**: query `delete` com filtros exatos `school_id + origem + payment_method_key + data BETWEEN`. Conta antes/depois para validar saldo zero.
- **Idempotência**: hash do arquivo gravado em `upload_records`. Re-upload do mesmo arquivo é detectado e exige confirmação.
- **Fim-de-semana**: diferenças causadas por `addDaysAndAdjust` são marcadas como "esperadas" no relatório (não erro).
- **Auditoria pós-importação**: grava em `import_audits` mesmo quando zero diferença, para histórico.

---

## Entregáveis

```text
migration                              → financial_entries (+6 cols), import_audits
src/lib/import/methodMapping.ts        → mapeamento estrito
src/lib/import/sponteAuditEngine.ts    → engine puro + tipos
src/test/sponteAuditEngine.test.ts     → testes unitários
supabase/functions/audit-import-differences/index.ts → IA conciliação
src/components/realizado/ImportacaoSponteAuditada.tsx → wizard 4 etapas
src/components/realizado/ImportAuditReport.tsx        → relatório final
edits em ImportacaoRealizado.tsx       → roteia Sponte para o novo wizard
edit em DataTable / Dashboard          → drill-down de rastreabilidade
```

---

## Escopo / fora de escopo

**Dentro:** importação Sponte de Recebimentos.
**Fora (próxima iteração se quiser):** estender a outros tipos de upload (Realizado bancário, vendas), retroaplicar rastreabilidade em registros já gravados (será null nos antigos).

Posso começar pela migration + engine + testes, e depois construir o wizard. Aprova?

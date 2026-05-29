# Plano: Consistência Financeira (Projeção + Realizado)

Mudanças críticas, aplicadas em duas fases para reduzir risco. Cada fase é entregável independente — você valida antes de seguir.

---

## Fase 1 — Saldo travado por snapshot + Fechamento reforçado

### 1.1 Saldo inicial sempre = saldo final do mês anterior

Hoje `Dashboard.tsx` recalcula tudo dinamicamente. Vamos tornar o **snapshot a fonte da verdade absoluta** para meses fechados.

Regra única, em ordem de prioridade:
1. Existe snapshot do mês anterior → `saldoInicial = snapshot.saldo_final` (ponto final, não soma mais nada).
2. Não existe → calcula dinâmico (como hoje), partindo de `school.saldo_inicial`.

Aplicado em:
- `src/components/Dashboard.tsx` (cálculo de saldo)
- `src/components/CashFlow.tsx` / `DailyFlowTable.tsx` (previsão de caixa)
- `src/components/realizado/RelatorioRealizado.tsx` (saldo do realizado)
- `src/lib/snapshotUtils.ts` (helper único `getSaldoInicialMes(month, snapshots, schoolSaldoInicial, entries, historical)`)

Resultado: depois de fechar Dezembro com saldo final R$ 150.000, Janeiro **sempre** abre em R$ 150.000, independente do que for editado depois.

### 1.2 Fechar mês — bloqueios e consolidação automática no Histórico

Nos componentes existentes (`FechamentoMeses.tsx` no Realizado, `usePeriodClosures` na Projeção):

**Antes de permitir fechar, validar:**
- ✅ Não existem entries com `categoria`/`tipo` fora do modelo financeiro da escola (`financial_model_templates`)
- ✅ Não existem categorias inválidas (tipo vazio, valor zero suspeito)
- ✅ Saldo calculado bate com saldo do snapshot do mês anterior (se houver)
- ❌ Se qualquer check falhar → modal lista as inconsistências, bloqueia o fechamento

**Ao fechar (transação única):**
1. Grava `period_closure_snapshots` (já existe)
2. **Novo:** `UPSERT` em `historical_monthly` por `tipo_valor` (receitas, despesas, investimentos, aportes, saldo_inicial, saldo_final) — torna o histórico a foto consolidada
3. Marca `period_closures.status = 'closed'` (já existe)

Arquivos:
- `src/hooks/usePeriodClosures.ts` — adicionar validações + upsert histórico
- `src/components/realizado/FechamentoMeses.tsx` — UI dos erros de validação
- novo helper `src/lib/closureValidation.ts`

---

## Fase 2 — Validação de upload por Modelo Financeiro

### 2.1 Validação estrita contra o modelo

Hoje uploads aceitam qualquer tipo. Vamos validar contra os tipos cadastrados no **modelo financeiro da escola** (`financial_model_template_items` + `type_classifications`).

Regra: só aceita match **exato** (após normalização de acento/case) com `name` do modelo. Variações como "Receita Real", "Saída", "Receita Operacional" **não** passam.

### 2.2 Tela de mapeamento obrigatório

No fluxo de upload (`src/components/upload/TipoMappingStep.tsx` + `src/components/realizado/ImportacaoRealizado.tsx`):

- Após detectar tipos no arquivo, comparar com o modelo.
- Tipos não reconhecidos abrem **etapa de mapeamento obrigatório**:
  - Lista cada tipo desconhecido com select das categorias válidas do modelo
  - Não permite avançar enquanto algum tipo estiver sem vínculo
  - Salva o mapeamento em `category_rules` (já existe) para reuso futuro
- Após mapear, o upload converte o tipo original para o tipo do modelo antes de inserir.

---

## Arquivos novos
- `src/lib/snapshotUtils.ts` — helpers de saldo travado (estender)
- `src/lib/closureValidation.ts` — checks pré-fechamento
- `src/lib/modelValidation.ts` — validação de tipos contra modelo da escola

## Arquivos editados (principais)
- `src/components/Dashboard.tsx`
- `src/components/CashFlow.tsx`
- `src/components/realizado/RelatorioRealizado.tsx`
- `src/components/realizado/FechamentoMeses.tsx`
- `src/hooks/usePeriodClosures.ts`
- `src/components/upload/TipoMappingStep.tsx`
- `src/components/realizado/ImportacaoRealizado.tsx`

## Sem mudanças de schema
Todas as tabelas necessárias já existem (`period_closure_snapshots`, `historical_monthly`, `financial_model_template_items`, `category_rules`, `type_classifications`). Sem migração.

## Riscos & mitigação
- **Risco:** snapshots antigos podem ter `saldo_final` errado (gerados antes do fix). **Mitigação:** botão "Recalcular snapshot" no fechamento (admin) para regenerar pontualmente.
- **Risco:** uploads em produção podem ter tipos legados não cadastrados. **Mitigação:** tela de mapeamento já cobre — usuário vincula uma vez e fica salvo.
- **Risco:** quebrar cálculos do Dashboard. **Mitigação:** entrego Fase 1 isolada; você valida antes de eu mexer no upload.

---

**Pergunta antes de começar:** OK começar pela **Fase 1** (saldo travado + fechamento reforçado) e validar antes de seguir para a Fase 2 (upload)?

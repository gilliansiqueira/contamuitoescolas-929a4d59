
# Auditoria do Saldo Final — antes de qualquer alteração

## 1. Onde o Saldo Final é calculado hoje

| # | Tela | Arquivo / função | Fórmula usada hoje |
|---|------|------------------|--------------------|
| 1 | Dashboard — Saldo Inicial do período | `src/hooks/useSaldoInicialPeriodo.ts` | `base + Σ snapshots < mês + Σ entries < mês (com regras de origem) + Σ historical_monthly < mês (só se mês sem upload)` |
| 2 | Dashboard — Saldo Final do período | `src/components/Dashboard.tsx` `saldoFinal` (linhas 300-318) | Chama `useSaldoInicialPeriodo` para o **mês seguinte** ao último selecionado. |
| 3 | Dashboard — Totais Receita/Despesa/Operações | `Dashboard.tsx` `tipoAggregations` + `totals` (linhas 145-281) | Agrega por `monthSources[m]`: snapshot | historico | upload | misto | projecao. Cada fonte tem branch próprio. |
| 4 | Fluxo Diário — Saldo Inicial | `DailyFlowTable.tsx` linha 167 | `useSaldoInicialPeriodo(schoolId, months)`. |
| 5 | Fluxo Diário — Saldo Final | `DailyFlowTable.tsx` `dailyData` (linhas 172-259) | Acumula dia-a-dia: `historical_monthly` (só se `src === 'historico'`) + `adjustedProjectedEntries` + `realizedEntries`. **Não** usa `useSaldoInicialPeriodo` do mês seguinte. |
| 6 | Fluxo (CashFlow) — Saldo diário | `CashFlow.tsx` `cashFlow` (linhas 37-60) | `saldoInicial = school.saldoInicial` (base bruto) + acumula `impacto` dos entries. **Ignora** snapshots, histórico e a SSOT `useSaldoInicialPeriodo`. |
| 7 | Fluxo — Consolidação mensal | `CashFlow.tsx` `monthly` (linhas 63-77) | `calculateTotals` sobre entries projetados. Ignora `historical_monthly` e `monthSources`. |
| 8 | Previsto x Realizado | `ProjectedVsReal.tsx` | Só `calculateTotals` por mês. Não calcula saldo. OK. |
| 9 | Fallback antigo do Dashboard (`selectedMonth === 'all'`) | `Dashboard.tsx` linhas 309-315 | `saldoInicialCalculado + Σ tipoAggregations com sinal`. Caminho paralelo ao hook. |

## 2. Causa raiz da divergência

Não existe **uma única função** que responda: "para o mês M da escola S, quais são as receitas, despesas e operações oficiais?". Em vez disso:

- `useSaldoInicialPeriodo` tem sua própria lógica de prioridade (snapshot > upload > histórico > projeção) implementada em código imperativo.
- `Dashboard.tipoAggregations` reimplementa a mesma prioridade em **outros** branches, com regras ligeiramente diferentes (ex.: `ORIGENS_NATIVAS` agrupadas por bucket sintético, `stemLabel` para mesclar rótulos).
- `DailyFlowTable.dailyData` reimplementa **de novo**, dia-a-dia, com regras próprias sobre quando incluir `historical_monthly` e quando aceitar projeções em mês com upload.
- `CashFlow` não conhece nada disso — parte do `saldoInicial` bruto da escola e soma todos os entries, o que diverge das outras três telas em qualquer escola que já tenha meses fechados ou histórico.

Como cada tela reconstrói a mesma decisão em lugares diferentes, patches pontuais (o último foi "ignorar projeções passadas em mês com upload") só corrigem um caminho. Os outros continuam com aritmética paralela.

Adicionalmente, a regra escrita no `useSaldoInicialPeriodo` **não** é "Saldo Inicial = Saldo Final do mês anterior" — ela acumula tudo desde o `saldoInicialBase` da escola percorrendo meses. Isso funciona por coincidência quando não há sobreposição, mas quebra quando `historical_monthly` e `financial_entries` cobrem o mesmo mês parcialmente.

## 3. Refatoração proposta (SSOT única de movimentação)

### 3.1 Nova função canônica

Criar `src/lib/periodMovement.ts`:

```ts
export type MonthMovement = {
  month: string;                 // 'YYYY-MM'
  source: 'snapshot' | 'fluxo' | 'historico' | 'projecao' | 'vazio';
  receitas: number;              // sempre >= 0
  despesas: number;              // sempre >= 0
  operacoesImpacto: number;      // com sinal (+ entrada, - saída)
  saldoMovimento: number;        // receitas - despesas + operacoesImpacto
  porTipo: { key: string; label: string; classificacao: Classificacao; sinal: Sinal; valor: number }[];
};

export function buildMonthMovement(
  month: string,
  ctx: {
    entries: ProjectedEntry[];
    historicalRows: HistoricalRow[];
    snapshotMap: Map<string, PeriodSnapshot>;
    classifications: TypeClassification[];
    modelItems: ModelItemRule[];
  }
): MonthMovement;
```

**Regra única de origem por mês** (não é mais duplicada em três lugares):

1. Se há snapshot fechado → `source = 'snapshot'`, valores vêm de `snap.por_tipo`.
2. Senão, se há entry com `origem === 'fluxo'` no mês → `source = 'fluxo'`. Movimentações vêm de `fluxo` + `manual` **do mês**. Histórico e projeções passadas são descartados para esse mês. Projeções futuras (`data >= hoje`) coexistem apenas na visão "Previsto".
3. Senão, se há `historical_monthly` para o mês → `source = 'historico'`. Receitas/despesas vêm do histórico. Operações vêm de entries `operacao` do mês (histórico não consolida operação).
4. Senão, se há entries projetadas → `source = 'projecao'`.
5. Senão → `source = 'vazio'`.

Nenhum caminho mistura histórico + fluxo para o mesmo mês. Nenhum caminho conta duas vezes.

### 3.2 Função de saldo

```ts
export function computeSaldoFinal(
  base: number,             // school.saldoInicial (âncora inicial)
  baseDate: string,         // school.saldoInicialData ('YYYY-MM')
  targetMonth: string,      // até e incluindo este mês
  monthsCtx: ...
): { saldoInicial: number; saldoFinal: number; movimento: MonthMovement };
```

Regra invariante:
- `saldoInicial(M) = saldoFinal(M-1)`
- `saldoFinal(M) = saldoInicial(M) + movimento(M).saldoMovimento`
- Recursivo desde `baseDate` (com memoização); nunca soma "tudo desde o começo" com regras paralelas.

### 3.3 Callers a migrar

Todos passam a consumir **apenas** `buildMonthMovement` / `computeSaldoFinal`:

- `Dashboard.tsx` — remove `tipoAggregations`, `totals`, `saldoInicialCalculado`, `saldoFinal`, `monthSources`, `includeEntry`. Passa a mapear cada mês selecionado → `MonthMovement` e agrega.
- `useSaldoInicialPeriodo.ts` — vira um wrapper trivial sobre `computeSaldoFinal(prevMonth)`.
- `DailyFlowTable.tsx` — usa `computeSaldoFinal(firstMonth - 1)` para o Saldo Inicial e a mesma decisão de `source` por mês. A distribuição diária (dia-a-dia) permanece local, mas usando o mesmo conjunto filtrado que `buildMonthMovement` retornou.
- `CashFlow.tsx` — troca `saldoInicial = school.saldoInicial` por `computeSaldoFinal(firstMonth - 1)` e usa `MonthMovement` para a consolidação mensal em vez de `calculateTotals` sobre todos os entries.
- `ProjectedVsReal.tsx` — segue usando `calculateTotals` (só compara projetado vs realizado, não calcula saldo), mas passa a receber o mesmo conjunto filtrado que `buildMonthMovement` já resolve.

### 3.4 Garantias impostas pela SSOT

- Receita entra apenas em `receitas` (uma vez).
- Despesa entra apenas em `despesas` (uma vez).
- Operação entra apenas em `operacoesImpacto` (nunca em receita/despesa).
- `ignorar` filtrado em `buildMonthMovement`; nenhum caller reintroduz.
- Em qualquer mês, exatamente **uma** fonte contribui para receitas/despesas. Operações do fluxo/manual são sempre somadas em mês `historico` (histórico não as tem).
- `saldoInicial` de qualquer tela = `saldoFinal` do mês anterior calculado pela mesma função.

## 4. Testes de regressão a adicionar

`src/test/periodMovement.test.ts`:

1. Mês só com projeção Sponte → receitas = soma Sponte, despesas = 0.
2. Mês só com histórico → bate com `historical_monthly`.
3. Mês com fluxo + histórico do mesmo mês → histórico é ignorado (sem dupla contagem).
4. Mês com fluxo + projeções passadas de Sponte/contas_pagar → projeções passadas ignoradas.
5. Cenário Fazenda RG Maio: `saldo_inicial=3881,36`, receitas=30615,77, despesas=53191,37, operações= +23109,15 −1150 → `saldo_final = 3264,91`.
6. Cenário Dourados: dado o input do usuário → `saldo_final = 105 770,26`.
7. Invariante `saldoInicial(M) === saldoFinal(M-1)` para 12 meses consecutivos, em cada combinação de fontes.

## 5. Ordem de execução (após você aprovar)

1. Criar `periodMovement.ts` + testes.
2. Migrar `useSaldoInicialPeriodo` para wrapper.
3. Migrar `Dashboard.tsx`.
4. Migrar `DailyFlowTable.tsx`.
5. Migrar `CashFlow.tsx`.
6. Rodar `bunx vitest run` e comparar telas nas duas escolas de referência.

Nenhum código será alterado até você confirmar este plano.

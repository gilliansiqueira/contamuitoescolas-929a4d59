## Escopo

Implementar 6 melhorias coordenadas em Projeção, Realizado, Dashboard, Simulação e tabelas de Fluxo, **sem alterar** lógica de fechamento de meses, RLS, autenticação, ou outras funcionalidades existentes.

---

### 1. Lógica oficial Projetado x Realizado (consolidar)

Hoje já existe a base (`source: 'misto'` no Dashboard). Vou padronizar e documentar a regra única:

- **Realizado** = apenas `origem='fluxo'` + manuais marcados como realizado (`tipo_registro='realizado'`).
- **Projetado** = qualquer entrada com `origem ∈ {sponte, cheque, cartao, contas_pagar}` ou manual com `tipo_registro='projetado'`.
- Realizado **nunca apaga** projetado. Coexistem sempre no mesmo mês.
- Centralizar essa regra em `src/lib/financialClassification.ts` (novo helper `isRealizado(entry)` / `isProjetado(entry)`) e usar em Dashboard, CashFlow, DailyFlowTable, ProjectedVsReal.

### 2. Upload de projeção com substituição parcial por data

Em `FileUpload.tsx`, quando o tipo for `sponte | cheque | cartao | contas_pagar` e já existirem projeções no banco para essa origem:

- Abrir diálogo de confirmação:
  - **Opção A:** "Substituir projeções a partir de DD/MM/AAAA" (default = menor data do novo arquivo). Mostra DatePicker.
  - **Opção B:** "Substituir tudo desta origem" (atual).
  - **Opção C:** "Cancelar".
- Delete apenas onde `origem = X AND tipo_registro='projetado' AND editado_manualmente=false AND data >= cutoffDate`.
- Realizado nunca é tocado. Manuais nunca são tocadas.

### 3. Card comparativo Previsto x Realizado no Dashboard

Em `Dashboard.tsx`, na aba **Projeção**, abaixo dos KPIs de Realizado/Projetado, adicionar um novo card "Previsto x Realizado":

```
RECEITAS                          DESPESAS
Prevista:   R$ X                  Prevista:   R$ X
Realizada:  R$ Y                  Realizada:  R$ Y
Diferença:  R$ Z (+/- N%)         Diferença:  R$ Z (+/- N%)
```

- Cores: verde quando realizado ≥ previsto (receita) / realizado ≤ previsto (despesa); vermelho ao contrário.
- Usa o mesmo período filtrado.

### 4. Linha de totais em Fluxo Diário e Fluxo

Em `DailyFlowTable.tsx` e `CashFlow.tsx`, adicionar linha fixa de totais ao final:

- Colunas: Entrada Prevista, Entrada Realizada, Saída Prevista, Saída Realizada (apenas as que existirem na tabela).
- Atualiza com filtros e período.
- Estilo: fundo `bg-muted`, `font-semibold`, `border-t-2`.

### 5. Aba de Simulação — nova estrutura

Reescrever `src/components/Simulation.tsx`:

**Tabela principal (entradas):**
- Colunas fixas: `Matrícula/Venda` | `Valor` | `Parcelas` | `Total` | [mês atual] | [+1] ... [+10]
- 11 colunas de meses a partir do mês atual.
- Para cada linha: distribuir `Valor` em N parcelas a partir do mês atual; coluna `Total` = Valor × Parcelas.
- Linha "+ Adicionar simulação" para nova entrada.

**Tabela secundária (consolidação):**
- Linhas: `Receita Projetada (sistema)` | `Receita Simulada` | `Total Consolidado`.
- Colunas: mesmos 11 meses.
- "Projetada do sistema" = soma de entradas projetadas por mês (origem ≠ fluxo, tipo='entrada').
- "Simulada" = soma das parcelas distribuídas das simulações.

Persistência: nova tabela `simulation_entries` (school_id, nome, valor, parcelas, mes_inicio, created_at).

### 6. Filtro de meses dinâmico no Dashboard

Substituir `MonthSelector.tsx` por um popover agrupado por ano:

- Trigger mostra resumo: "3 meses selecionados" / "Mai/2026 - Jul/2026" / "Todos os meses".
- Conteúdo: lista por ano (2024, 2025, 2026...) com chips de meses (Jan–Dez), múltipla seleção.
- Botões: "Todos", "Limpar", "Últimos 3 meses", "Ano atual".
- Suporte a intervalo: shift+click seleciona range.
- Valor continua sendo string (`'all'` ou CSV `'2026-05,2026-06,...'`) para manter compatibilidade com `matchesMonthFilter` que já aceita CSV.

---

## Banco de dados

Apenas uma nova tabela:

```sql
CREATE TABLE public.simulation_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  nome text NOT NULL DEFAULT '',
  valor numeric NOT NULL DEFAULT 0,
  parcelas integer NOT NULL DEFAULT 1,
  mes_inicio text NOT NULL,  -- 'YYYY-MM'
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- RLS análoga a investment_entries (is_admin OR user_has_school_access).
```

---

## Arquivos afetados

- **Novo:** `src/lib/financialClassification.ts` — helpers `isRealizado/isProjetado`.
- **Novo:** `src/components/dashboard/PrevistoRealizadoCard.tsx` — card comparativo.
- **Novo:** migration `simulation_entries`.
- **Reescrito:** `src/components/Simulation.tsx`, `src/components/MonthSelector.tsx`.
- **Editado:** `src/components/FileUpload.tsx` (diálogo de substituição parcial), `src/components/Dashboard.tsx` (novo card + uso de helpers), `src/components/CashFlow.tsx` + `src/components/DailyFlowTable.tsx` (linha de totais).

## Não-mudanças (garantidas)

- Fechamento de meses, snapshots, consolidação em `historical_monthly` permanecem como estão.
- `realized_entries`, `period_closures`, RLS, auth, roles, investimentos: intocados.
- Manuais (`editado_manualmente=true`) nunca apagados.
- Auto-consolidação após upload de fluxo permanece.

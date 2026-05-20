# Plano de execução

Vou entregar em 4 blocos independentes pra você poder testar cada um antes do próximo. Tudo respeita os filtros multi-mês já existentes (`SingleMonthPicker` em modo multi) e os módulos atuais de Projeção vs Realizado (sem misturar lógica).

---

## Bloco 1 — Card de Investimentos (Dashboard da Projeção)

**Objetivo:** card moderno estilo app de banco, com gráfico de área e métricas vivas.

- Reescrever `src/components/InvestimentoSection.tsx` (ou criar `InvestimentoCard.tsx` consumido no `Dashboard.tsx`).
- Gráfico de **área (Recharts `AreaChart`)** com gradiente, evolução mês a mês do **saldo acumulado**.
- Métricas no topo do card:
  - Total Investido = Σ `aplicacao`
  - Total Resgatado = Σ `resgate` (secundário, pequeno)
  - Rendimento = Σ `rendimentos` + Σ `rendimento_provisionado` − Σ `encargos`
  - Rentabilidade % = Rendimento / Total Investido
  - Valor Total Acumulado = último `saldo_final` do período
- Respeita os filtros globais do Dashboard (multi-mês). Recalcula via `useMemo` a partir de `investment_entries` filtrado.
- Sem mudança de schema — a tabela `investment_entries` já tem todos os campos.

## Bloco 2 — Categorias e Tipos Financeiros (CRUD + modelos base)

**Objetivo:** gerir categorias usadas em Histórico Financeiro (projeção) e Fechamento (realizado).

- Tela única `CategoriasManager` acessível em **Configurações**, com abas:
  - **Histórico Financeiro** → CRUD em `historical_monthly.tipo_valor` (via tabela auxiliar nova `historical_tipos` pra permitir editar/renomear sem perder vínculo).
  - **Plano de Contas** → já existe (`chart_of_accounts`), só adicionar atalho.
- Migration:
  - Nova tabela `historical_tipos (id, school_id, nome, grupo, sort_order, ativo)` com RLS por escola.
  - Seed automático por escola com os modelos base: **Receitas, Despesas, Distribuição de Lucros, Investimentos, Impostos, Custos Fixos, Custos Variáveis, Outros**.
- Renomear categoria atualiza referências em `historical_monthly` via update em lote.
- Excluir categoria pede confirmação se houver dados vinculados (mantém histórico, só desativa).

## Bloco 3 — Históricos editáveis (Vendas / Indicadores / Conversão)

**Objetivo:** dar CRUD + import por planilha + filtros em cada um.

Em **Relatório Realizado**, adicionar sub-aba **"Histórico"** dentro de cada módulo:

- **Vendas** (`monthly_revenue` e/ou `sales_analysis_orders` — confirmar com você qual é o alvo de "vendas" antes de mexer; meu padrão será `sales_analysis_orders` por ser o registro detalhado).
- **Indicadores** (`kpi_values`): tabela editável mês × KPI, com import CSV (colunas: mês, kpi_nome, valor).
- **Conversão** (`conversion_data`): tabela editável com contatos/matrículas por mês e tipo.

Cada histórico ganha:
- Filtro multi-mês (mesmo `SingleMonthPicker multi`).
- Campo de busca.
- Edição inline + exclusão.
- Botão "Importar planilha" reutilizando o fluxo de 3 passos do `ImportacaoRealizado`.

Sem schema novo (tabelas já existem).

## Bloco 4 — Simulação por mês (colunas)

**Objetivo:** transformar a aba Simulação numa matriz de meses em colunas.

- Reescrever `src/components/Simulation.tsx`:
  - Linhas: campos editáveis (Nº Vendas/Matrículas, Ticket Médio, Nº Parcelas).
  - Colunas: meses selecionados no filtro multi-mês.
  - Linhas calculadas (read-only): Total Vendido, Valor Parcela, **Projetado a Receber por mês** (distribuído pelas parcelas a partir do mês da venda), **Projetado a Pagar** (puxado de `financial_entries` projetado já existente — não simula despesa nova), **Resultado**.
- Persistência: nova tabela `simulation_monthly (school_id, scenario_id, month, vendas, ticket, parcelas)` com RLS.
- Resultado da simulação **soma** com a projeção existente nos dashboards (flag `origem='simulacao'` já existe em `FinancialEntry`).

---

## Ordem sugerida de execução

1. Bloco 1 (rápido, visual, baixo risco) ✅
2. Bloco 4 (simulação) — é o que mais muda fluxo, melhor cedo
3. Bloco 2 (categorias)
4. Bloco 3 (históricos CRUD) — maior em volume de UI

## Perguntas antes de começar

1. Em **Bloco 3 / Vendas**, o "histórico de vendas" é o `sales_analysis_orders` (pedidos detalhados) ou o `monthly_revenue` (faturamento mensal agregado)?
2. Em **Bloco 4**, a Simulação deve substituir a tela atual (matrículas/ticket/inadimplência em campos únicos) ou conviver como nova aba "Simulação por mês"?
3. Posso começar pelo **Bloco 1** já enquanto você responde 1 e 2?

## Modo Demonstração Público (/demo)

Criar uma experiência pública e somente-leitura do sistema financeiro com uma empresa fictícia "Demo", populada com dados realistas para preencher todas as telas (dashboard, gráficos, indicadores, previsão de caixa, projeção, realizado, vendas).

### 1. Backend — Empresa e dados Demo

Criar uma migração que insere (de forma idempotente, com `ON CONFLICT DO NOTHING` baseado em um `id` fixo bem conhecido):

- 1 escola `schools` com `id` fixo (ex.: `00000000-0000-0000-0000-00000000d3m0`) e nome **"Demo"**.
- Modelo financeiro padrão associado.
- 12 meses de dados (jan/2026 → dez/2026) realistas:
  - `monthly_revenue` — faturamento crescente (R$ 180k → R$ 260k).
  - `financial_entries` (projeção) — receitas (mensalidades, matrículas, material), despesas (folha, aluguel, marketing, fornecedores, impostos), recorrentes mês a mês.
  - `realized_entries` — espelhando ~95% da projeção para meses passados.
  - `historical_monthly` — saldos iniciais + valores históricos.
  - `investment_entries` — aplicações, resgates, rendimentos.
  - `receivable_categories` + `receivable_category_values` — recebíveis por canal.
  - `sales_analysis_channels`, `sales_analysis_payment_methods`, `sales_analysis_products`, `sales_analysis_orders` + `_items` — ~40 pedidos espalhados nos 12 meses.
  - `conversion_data` — contatos/matrículas (ativo e receptivo).
  - `kpi_definitions` + `kpi_thresholds` + `kpi_values` — 4–5 indicadores típicos (margem, inadimplência, conversão, ticket médio).
  - `expense_ceilings`, `payment_delay_rules`, `chart_of_accounts`, `module_tabs` — config mínima coerente.
- Função `public.is_demo_school(uuid)` que retorna `true` quando o `school_id` é o ID da Demo.
- **Política RLS pública**: adicionar policies `SELECT` extras (`USING (is_demo_school(school_id))`) em todas as tabelas listadas acima, permitindo leitura anônima (role `anon`) apenas dos dados da Demo. Nenhuma policy nova de INSERT/UPDATE/DELETE — escrita continua bloqueada.
- `GRANT SELECT ON <tabela> TO anon` para cada tabela envolvida.

### 2. Frontend — Rota /demo somente leitura

- Novo arquivo `src/contexts/DemoModeContext.tsx` com `useDemoMode()` retornando `{ isDemo, demoSchoolId }`.
- Wrapper `<DemoRoute>` em `src/components/DemoRoute.tsx` que:
  - Define `isDemo=true` e força `schoolId` = ID fixo da Demo.
  - Renderiza o `<Index />` existente sem `ProtectedRoute`.
  - Mostra um **banner fixo no topo**: "Modo Demonstração — somente visualização. [Criar minha conta]".
- Em `src/App.tsx`: adicionar `<Route path="/demo" element={<DemoRoute><Index /></DemoRoute>} />` (pública, sem auth).
- `useAuth` ajustado para tolerar sessão ausente quando `isDemo` (não redireciona).
- `SchoolSelector`: quando `isDemo`, esconde o seletor e mostra apenas "Demo".
- **Bloqueio de escrita na UI**:
  - Criar hook `useReadOnly()` baseado em `useDemoMode`.
  - Em componentes de configuração, formulários, botões de salvar/importar/excluir/upload/fechar período: quando `readOnly`, desabilitar (`disabled`) e adicionar tooltip "Indisponível no modo demonstração".
  - Componentes mais críticos: `FileUpload`, `HistoricoFinanceiroConfig`, `UsersConfig`, `ModelosFinanceirosManager`, `ImportacaoRealizado`, `ImportacaoVendas`, `EditEntryDialog`, `PedidoDialog`, `FechamentoMeses`, `SaldoInicialConfig`, `PaymentDelayConfig`, `TypeClassificationConfig`, `KpiConfigDrawer`, `CadastrosConfig`, `ExportImport`, `reset-user-password` UI.
  - Defesa em profundidade: as RLS impedem qualquer escrita mesmo se um botão escapar.

### 3. Detalhes técnicos

- ID fixo da Demo (UUID determinístico) usado tanto na seed quanto no frontend via `VITE_DEMO_SCHOOL_ID` lido de `src/lib/demo.ts` (constante hardcoded — sem env).
- Seed roda em uma única migração; usa `INSERT ... WHERE NOT EXISTS` ou `ON CONFLICT` para ser reexecutável sem duplicar.
- Banner usa cores semânticas do design system (sem cores diretas).
- Não altera o fluxo de login real nem usuários existentes.
- Nenhuma rota nova além de `/demo`.

### 4. Fora de escopo

- Reset automático/agendado dos dados da Demo (pode ser feito manualmente reexecutando a seed).
- Tradução do banner / multi-idioma.
- Telemetria de visitas à demo.

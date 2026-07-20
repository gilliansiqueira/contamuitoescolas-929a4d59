
# Plano de implementação

Três mudanças coordenadas, entregues em ordem para minimizar retrabalho.

---

## 1) Filtro de período global (intervalo) no topo

Adicionar ao lado do nome da empresa (em `src/pages/Index.tsx`) um seletor **"De → Até"** (mês inicial e mês final).

- Novo contexto `GlobalPeriodProvider` (`src/contexts/GlobalPeriodContext.tsx`) expondo `{ startMonth, endMonth, setRange }`, com default = últimos 12 meses.
- Persistência por escola em `localStorage` (`global-period:{schoolId}`) para lembrar a seleção ao trocar de escola.
- Cada aba passa a **ler** desse contexto em vez do seu filtro local:
  - Abas de mês único (Dashboard, Fluxo Diário, Indicadores card, Conversão card único): usam `endMonth`.
  - Abas de intervalo (Relatório Realizado, Recebimento por Categoria, Vendas, Análise de Vendas, Teto de Gastos, Conversão gráficos): usam `[startMonth, endMonth]`.
- Filtros locais existentes são removidos das abas listadas acima; apenas o Teto de Gastos mantém o seletor de semestre como refinamento adicional dentro do intervalo global.

Arquivos tocados: `Index.tsx`, `Dashboard.tsx`, `DailyFlowTable.tsx`, `RelatorioRealizado.tsx`, `IndicadoresDashboard.tsx`, `ConversaoDashboard.tsx`, `VendasDashboard.tsx`, `AnaliseVendasDashboard.tsx`, `RecebimentoCategoria.tsx`, `TetoGastos.tsx`.

---

## 2) Fluxo Diário — modo híbrido automático

Em `DailyFlowTable.tsx`, detectar automaticamente a **última data com movimento realizado** no mês selecionado (upload real ou realizado).

- Até essa data (inclusive): mostra colunas **Realizado** preenchidas; colunas Previsto ficam ocultas visualmente para essas linhas (mostrando "—").
- A partir do dia seguinte: mostra apenas **Previsto** (Realizado fica "—").
- Uma linha divisória sutil ("Últimos dados realizados em DD/MM — previsão a partir daqui") separa as duas seções.
- Saldo Final Realizado acumula até a data de corte e, a partir dela, passa a acumular Saldo Final Previsto **partindo do último realizado**, dando o saldo final projetado do mês em uma única coluna contínua.
- Se não houver realizado no mês: comportamento atual (100% previsto). Se o mês inteiro é passado com dados realizados: 100% realizado.

Regra reusa a lógica SSOT já em `periodMovement.ts` (nada de recálculo paralelo).

---

## 3) Dashboard — cards manuais arrastáveis por mês

Novos "cards livres" no Dashboard, com **a mesma aparência dos cards de Operações**, editáveis apenas por admin.

### Modelo de dados
Nova tabela `dashboard_manual_cards`:
```
id uuid pk
school_id uuid fk schools
month text (YYYY-MM)
label text
value numeric
section text check in ('operacoes','resultado')  -- destino atual
sort_order int
created_at, updated_at
```
- RLS: SELECT para membros da escola; INSERT/UPDATE/DELETE apenas admin.
- GRANT authenticated + service_role.
- Nunca entra em `periodMovement` / SSOT — puramente visual/informativo.

### UI
- Componente `ManualCardsSection` exibido no Dashboard, agrupado por seção (Operações / Resultado).
- Admin vê botão "+ Adicionar card" e ícone de edição/exclusão em cada card.
- **Drag-and-drop** (react já tem `framer-motion`; usar `@dnd-kit/core` — leve) para arrastar entre "Operações" e "Resultado" e reordenar. A seção de destino é persistida em `section`.
- Um card existe por combinação (school, month, id). O Dashboard mostra os cards do mês ativo (do filtro global).
- Não impactam saldo, resultado nem gráficos — apenas exibidos ao lado dos cards existentes com um badge discreto "Manual".

---

## Ordem de entrega
1. Migration + contexto global + refactor mínimo de `Index.tsx` para injetar o seletor.
2. Adaptar Dashboard e Fluxo Diário ao contexto global (maior impacto).
3. Implementar Fluxo Diário híbrido.
4. Migrar demais abas para o filtro global (remover filtros locais).
5. Criar tabela + UI dos cards manuais com drag-and-drop.

## Detalhes técnicos
- Sem mudanças em `ledgerEngine`, `projectionEngine`, `periodMovement`, `classificationUtils` — SSOT preservada.
- Cards manuais isolados de qualquer cálculo financeiro por design (não entram em nenhuma agregação).
- Dependência nova: `@dnd-kit/core` + `@dnd-kit/sortable` (~15KB gzip).
- Persistência do filtro global via `localStorage`, não banco (preferência de UI por usuário/escola).

Confirma que posso seguir com esse plano?

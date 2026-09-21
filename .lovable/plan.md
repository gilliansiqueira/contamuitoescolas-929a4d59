# Gráfico "Despesas por Categoria" — versão mobile legível (Análise de Despesas)

## Problema
No celular, o gráfico principal da Análise de Despesas renderiza a versão desktop do Recharts: nomes de categoria truncados (FINANCEIRO), rótulos de valor sobrepostos aos nomes e barras invisíveis (uma categoria dominante achata todas as outras).

## Causa raiz (confirmada no código)
`useContainerWidth` (RelatorioRealizado.tsx, linhas 49–63) roda uma vez na montagem e observa o elemento via `ref.current`. Como o gráfico só é renderizado depois dos dados carregarem (`barChartData.length > 0`), o ref ainda é nulo quando o efeito roda — a largura fica 0 para sempre e a condição mobile (`containerWidth > 0 && containerWidth < 560`) nunca é satisfeita. A versão mobile de barras HTML existe, mas nunca ativa.

## Solução

### 1. Corrigir a medição de largura
Trocar o padrão do hook para **callback ref**: observar o elemento no momento em que ele é anexado ao DOM (e desconectar ao desanexar). Assim a largura passa a existir quando o gráfico monta e a versão mobile passa a funcionar de verdade.

### 2. Redesenho mobile (< 560px) — direção "Lista progressiva" (escolhida)
Substituir o fallback atual por uma lista progressiva em HTML/CSS (sem Recharts), no card existente:

- **Cabeçalho**: título "Despesas por Categoria" + chip do período (ex.: "12 MESES" ou o mês ativo).
- **Lista de barras** (categorias ordenadas por valor, do maior para o menor):
  - Categoria **acima de 30% do faturamento**: selo pequeno "Acima de 30% do faturamento" em coral acima do nome; valor em coral; barra mais grossa (h-2.5) com leve brilho, na cor `destructive`.
  - Demais categorias: nome à esquerda, valor (R$) e "% da receita" à direita; barra fina na cor `primary` (teal), largura proporcional à maior categoria.
  - Animação de entrada: barras crescem com pequeno stagger (mantém o padrão atual de `motion.div`).
- **Categorias pequenas condensadas**: as que representam menos de 5% do total de despesas saem da lista de barras e entram numa grade de 2 colunas de cartõezinhos (nome, valor, %).
- **Rodapé**: total de despesas do período e "margem consumida" (despesas ÷ faturamento) em coral quando ultrapassar 100% — exibido somente com faturamento informado.
- **Modo noturno**: apenas tokens semânticos (`destructive`, `primary`, `muted`, `card`, `border`) — no escuro o vermelho já é o coral definido anteriormente.

### 3. Desktop
Nada muda — continua o Recharts horizontal atual (≥ 560px).

## Garantias
- Nenhum recálculo financeiro: os valores vêm do mesmo `barChartData` já computado pelas regras SSOT; totais são soma de exibição.
- Regra dos 30% do faturamento preservada (selo/cor coral).
- Nenhuma migração de banco; nenhuma outra tela afetada.

## Verificação
- `bunx tsgo --noEmit -p tsconfig.app.json`.
- Playwright a 390px em /demo (aba Realizado → Análise de Despesas): confirmar que a lista progressiva aparece, nomes completos legíveis, valores/% visíveis, categorias acima de 30% em coral, e que o desktop (1280px) continua com o gráfico Recharts.
- Screenshot em modo claro e noturno.

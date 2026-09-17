# Filtro por categoria com gráfico de linha — Análise de Despesas

Adicionar, na aba Análise de Despesas (Relatório Realizado), um filtro que permite escolher uma categoria-mãe (ex.: DESPESAS FIXAS) ou uma subcategoria (ex.: Aluguel). Ao selecionar, aparece um gráfico de linha com a evolução mensal daquele item — ano atual vs ano anterior, desde janeiro do ano anterior (ex.: se o mês ativo é Ago/2026, o gráfico cobre jan/2025 em diante).

## Como vai funcionar

1. **Seletor** no card do Faturamento (área circulada na imagem), rotulado "Filtrar por categoria":
   - lista todas as categorias-mãe e subcategorias que possuem lançamentos realizados na empresa, com busca por texto;
   - opção "Todas as despesas" (padrão) mantém a visão atual.
2. **Gráfico de linha**: ao escolher um item, surge logo abaixo um gráfico de evolução mensal daquela categoria/subcategoria:
   - mesmo visual do "Despesas totais — comparativo anual" (reutiliza o componente existente `YoYLineChart`): ano atual em destaque, ano anterior tracejado, acumulado e variação %;
   - o gráfico considera todos os meses com dados, não apenas o mês filtrado na tela;
   - aparece apenas quando um único mês está selecionado (mesma regra do comparativo anual atual).
3. **Nada mais muda**: o gráfico de barras por categoria, os blocos de lançamentos, o faturamento e os insights permanecem exatamente como estão.

## Detalhes técnicos

- Tudo em `src/components/realizado/RelatorioRealizado.tsx` (frontend apenas, sem alteração de banco):
  - novo estado `categoriaFiltro` e um `useMemo` que monta a lista de opções a partir de `entries` (subcategorias via `conta_nome`, categorias-mãe via `contaGrupoMap`), deduplicadas e ordenadas;
  - `Select`/`Combobox` (padrão shadcn já usado no projeto) inserido no card do faturamento, alinhado à direita;
  - quando há seleção, filtra `entries` pelo item escolhido e renderiza um segundo `<YoYLineChart>` com título dinâmico (`{nome} — comparativo anual`), logo abaixo do card do faturamento;
  - o comparativo anual de "Despesas totais" existente continua intacto.
- O filtro respeita o mesmo conjunto de dados da tela (lançamentos realizados da empresa) — nenhum cálculo novo fora da fonte única.

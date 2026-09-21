# Quatro melhorias: lançamentos no filtro, modo noturno, app no celular e comparativo de períodos

## 1. Lançamentos na Análise de Despesas (filtro por categoria)

Hoje, ao filtrar uma categoria ou subcategoria, aparece só o gráfico de linha. Passa a aparecer, logo abaixo, a lista de lançamentos daquele item — do mesmo jeito que já existe nas categorias-mãe:

- lista de todos os meses cobertos pelo gráfico (ano atual + ano anterior), agrupada por mês, com subtotal de cada mês;
- cada linha mostra data, descrição/complemento e valor;
- busca por texto dentro da lista e botão para expandir/recolher;
- meses recolhidos por padrão, exceto o mês selecionado na tela.

## 2. Modo noturno: vermelho mais suave

O vermelho atual fica pesado no fundo escuro. Ajuste da paleta escura para um tom rosado/coral mais legível, aplicado em todos os lugares que usam a cor de alerta (valores negativos, saídas, variações negativas, botões de excluir) — sem mudar nada no tema claro.

## 3. App no celular (instalável pelo navegador)

O relatório passa a poder ser instalado na tela inicial do celular, direto pelo navegador, sem loja de aplicativos:

- nome "Conta Muito Relatórios", ícones próprios e cor de tema da marca;
- abre em tela cheia, sem barra de endereço;
- iPhone: Compartilhar > Adicionar à Tela de Início. Android: menu do navegador > Instalar aplicativo.

Continua sendo o mesmo sistema (precisa de internet); não haverá uso offline.

## 4. Comparativo de períodos

A aba "Dados" sai do menu principal dos clientes (passa a ficar em Configurações, visível apenas para a equipe) e no lugar dela entra a aba **Comparativo**.

Na tela o cliente escolhe dois períodos (ex.: jan–ago/2025 x jan–ago/2026), com atalhos rápidos ("mesmo período do ano anterior", "ano completo anterior"). O resultado aparece em três blocos:

1. **Resumo** — cartões com Receita, Despesa, Resultado e Saldo de caixa: valor do período A, do período B, diferença em R$ e em %, com seta e cor indicando melhora ou piora (para despesa, subir é ruim).
2. **Gráficos** — evolução mês a mês dos dois períodos sobrepostos (receita, despesa e resultado), alinhados pela posição do mês (1º mês, 2º mês...), para períodos de tamanhos diferentes funcionarem.
3. **Variação por categoria** — tabela com categoria-mãe (expansível em subcategorias): valor A, valor B, diferença R$, diferença % e participação sobre o total; ordenável, destacando as maiores altas e quedas.

Tudo com a mesma base de dados das outras telas — sem recálculo próprio.

## Detalhes técnicos

- `RelatorioRealizado.tsx`: reaproveitar o padrão de listagem do `CategoryBlock` num novo componente `FiltroLancamentos` alimentado por `entriesForFiltro` (hoje reduzido a `{data, valor}` — passa a carregar também `id`, `descricao`, `complemento`, `conta_nome`).
- `src/index.css`: no bloco `.dark`, `--destructive` passa de `0 62.8% 30.6%` para um coral/rosa (~`350 75% 62%`) com `--destructive-foreground` ajustado; conferir contraste nos gráficos (`hsl(var(--destructive))` em `CategoryBlock`/`DailyFlowTable`).
- PWA: `public/manifest.webmanifest` + ícones 192/512 (maskable) em `public/`, tags no `index.html` (`manifest`, `theme-color`, `apple-mobile-web-app-*`, `apple-touch-icon`). Sem service worker, sem `vite-plugin-pwa`.
- Comparativo: novo `src/components/comparativo/ComparativoPeriodos.tsx` + hook de agregação usando os mesmos dados/engines já existentes (`ledgerEngine`/`classificationUtils`, `useFinancialData`/entradas realizadas). Em `src/pages/Index.tsx`, trocar `datatable` por `comparison_periods` em `mainTabs` e mover `DataTable` para `settingsTabsBase` com `adminOnly: true`.

# Memory: index.md
Updated: agora

# Project Memory

## Core
- Architecture: Multi-tenant by `school_id` via Supabase. Never use localStorage.
- Styling: Light theme, teal & orange palette. Hide operational screens under Settings.
- Architecture: Strict logic/UI isolation between 'Projeção' and 'Relatório Realizado'.
- Formatting: Always support Brazilian number/date formats natively (e.g., 1.500,50).
- Payments: Strict method mapping. Allowed: Cartão, PIX, Boleto. 'Outros' is forbidden.
- Filtering: Strict period filtering. No residual values outside the selected months.

## Memories
- [Visão Geral](mem://projeto/visao-geral) — BPO financeiro para múltiplas escolas, integrações e projeções
- [Persistência de Dados](mem://arquitetura/persistencia-dados) — Multi-tenant via Supabase, sem localStorage
- [Regras por Escola](mem://funcionalidades/regras-por-escola) — Prazos por escola, fins de semana passam para o próximo dia útil
- [Cenários Financeiros](mem://funcionalidades/cenarios-financeiros) — Lógica de cenários Real, Pessimista e Otimista
- [Padronização Pagamentos](mem://dados/padronizacao-pagamentos) — Mapeamento rigoroso para Boleto/PIX e tipos permitidos
- [Lógica Fluxo e Saldo](mem://financeiro/logica-fluxo-saldo) — Saldo inicial dinâmico e separação Realizado/Projetado
- [Classificação Contábil](mem://financeiro/classificacao-contabil) — Hierarquia de tipagem (Tabela > Texto > Sinal), override manual
- [Filtro de Período Estrito](mem://funcionalidades/filtro-periodo-estrito) — Filtragem rigorosa e restrita aos meses selecionados
- [Formatação Brasileira](mem://dados/formatacao-brasileira) — Conversão nativa de formatos brasileiros (ex: 1.500,50)
- [Recebíveis por Origem](mem://funcionalidades/recebiveis-por-origem) — Agrupamento por canais fixos, apenas dados projetados
- [Plano de Contas](mem://funcionalidades/plano-de-contas-simplificado) — Lógica paste-to-parse, sem códigos contábeis
- [Importação Realizado](mem://features/importacao-realizado-regras) — Auto-mapeamento de categoria filha para categoria mãe
- [Faturamento Relatório](mem://features/relatorio-realizado-faturamento) — Inserção manual de faturamento para cálculo de despesas
- [Design e Identidade Visual](mem://style/identidade-visual-ui-design) — Tema claro (verde/laranja), telas operacionais nas configurações
- [Exportação TSV](mem://features/relatorio-realizado-exportacao-tsv) — Exportação no formato TSV (Categoria Mãe / Filha / Valor)
- [Validação e Mapeamento](mem://funcionalidades/validacao-importacao-mapeamento-flexivel) — Upload em 3 etapas (salva último mapeamento)
- [Templates KPI](mem://features/indicadores-kpi-templates) — Estruturas reutilizáveis (ex: Modelo Escolas) aplicadas por escola
- [Refinamento Visual KPI](mem://style/indicadores-kpi-visual-refinamento) — Cores dinâmicas de acordo com o desempenho e status
- [Isolamento de Módulos](mem://projeto/diretrizes-isolamento-modulos) — Separação estrita Projeção vs Relatório Realizado
- [Abas Modulares](mem://features/relatorio-realizado-modularidade-abas) — Ativação/desativação por escola persistida em module_tabs
- [Faixas de Conversão](mem://features/relatorio-realizado-conversao-thresholds) — Limites percentuais para origens Ativo e Receptivo
- [Fechamento de Períodos](mem://features/realizado-fechamento-periodos) — Fechar/reabrir meses no Realizado, bloqueio via triggers de banco
- [Edição de Tipos no Histórico](mem://features/historico-edicao-tipos) — Renomear/excluir conta_nome com reclassificação obrigatória
- [Análise de Vendas](mem://features/relatorio-realizado-analise-vendas) — Aba MVP com pedidos, cards dinâmicos, filtros e cadastros (produtos/canais/formas)
- [Aba Vendas](mem://features/relatorio-realizado-vendas) — Receitas por forma de pagamento + bandeiras de cartão com ícones

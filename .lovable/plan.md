# Operações de caixa em todos os clientes + pente fino dos erros de Dourados

## Objetivo
Garantir que as Operações (transferência, antecipação, aporte, aplicação, resgate, rendimento etc.) sejam contabilizadas no Caixa de todos os clientes, fora de Receita, Despesa e Resultado. Depois, verificar em todos os clientes os mesmos erros encontrados em Dourados.

## Etapa 1 — Diagnóstico (antes de alterar qualquer coisa)
A causa ainda não foi confirmada, então o primeiro passo é descobrir por que as operações não aparecem. Para cada cliente ativo:
- Contar os lançamentos de operação por mês e por origem (fluxo, manual, histórico, projeção, realizado).
- Conferir se o modelo financeiro do cliente classifica esses tipos como operação.
- Comparar o total de operações nos dados com o que a plataforma e o PDF mostram.
- Listar exatamente quais linhas ficaram de fora e por quê: tipo sem classificação, mês lido como histórico sem as saídas, origem nativa fora do filtro etc.

Resultado: um relatório por cliente com as linhas responsáveis por cada diferença.

## Etapa 2 — Correção geral (na fonte única)
- Corrigir a regra no ponto central de cálculo, sem regra própria por tela, para que plataforma, fluxo diário e PDF recebam o mesmo número.
- Meses históricos: considerar entradas e saídas de operação, não apenas as entradas.
- Tipos de operação sem classificação no modelo do cliente aparecem como pendência. Não entram por adivinhação.
- Os dados dos clientes não serão alterados.

## Etapa 3 — Pente fino dos erros de Dourados em todos os clientes
Para cada cliente, no último mês com dados, comparar plataforma × PDF em:
1. Operações de caixa (entradas, saídas e impacto líquido)
2. Saldo final realizado
3. Maior ponto de atenção somado por categoria-mãe
4. Resultado mensal, incluindo ajustes manuais
5. Meses zerados na evolução de receitas e despesas
6. Soma de matrículas e contatos apenas de janeiro até o mês do relatório, nos dois anos
7. Comparação anual: ano selecionado × ano anterior, sem meses futuros

Cada divergência é registrada com as linhas que a explicam. Divergências com causa nova recebem correção geral, não correção para um cliente só.

## Etapa 4 — Validação
- Testes automáticos para operações em mês de fluxo, mês histórico e mês projetado.
- PDF real de Dourados (agosto/2026) e de pelo menos mais dois clientes, comparados com a plataforma.
- Para gerar os PDFs reais, preciso entrar na prévia com uma conta de administrador. Vou pedir sua aprovação para escolher a conta.

## Detalhes técnicos
- Arquivos envolvidos: `src/lib/periodMovement.ts` (`buildMonthMovement`/`resolveMonthSource`), `ledgerEngine`, `classificationUtils`, `tipoMeta`, `Dashboard.tsx` (resumo do PDF) e `mesCompletoPdf.ts`.
- Diagnóstico por consultas somente leitura em `financial_entries`, `historical_monthly`, `realized_entries` e `financial_model_template_items`, agrupadas por `school_id`, mês e tipo.
- Sem migrations previstas. Se aparecer necessidade de mudar a estrutura, ela será feita por migration e explicada antes.

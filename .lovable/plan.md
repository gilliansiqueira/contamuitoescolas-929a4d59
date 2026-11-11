# Receitas do ano todo no relatório da Joinville Norte

## O que encontrei
- A Norte só tem extrato e lançamentos na plataforma a partir de setembro/2026. De janeiro a agosto não existe nenhum lançamento de receita, por isso a página "Evolução de receitas" mostra só setembro e outubro.
- Já os valores de "Recebimento por categoria" (Turma, Material, Matrícula...) estão gravados de janeiro a novembro/2026.
- As três páginas novas de histórico (contatos receptivos, ativos e matrículas) também não apareceram no PDF que você mandou, mesmo com 2020–2025 salvos.

## O que vou fazer
1. **Completar jan–ago na Evolução de receitas**: nos meses sem lançamentos na plataforma, usar o total de "Recebimento por categoria" daquele mês. Os meses com lançamentos continuam vindo do cálculo oficial, sem misturar as duas fontes no mesmo mês. Uma nota na página avisa quais meses vieram das categorias.
2. **Páginas de histórico comercial**: gerar o relatório da Norte aqui, descobrir por que as páginas não entraram e corrigir.
3. **Conferir o PDF gerado** (out/2026 da Norte): página de receitas com jan–out e as três páginas de histórico.

## Detalhes técnicos
- `Dashboard.tsx` `buildAnnual('receitas')`: quando `buildMonthMovement` retorna `vazio`, cair para a soma de `receivable_category_values` do mês (apenas receitas; despesas/resultado ficam como estão). Marcar meses de fallback em `MesCompletoData` para a nota no `mesCompletoPdf.ts`.
- Teste puro da regra de fallback (mês com movimento ignora categorias; mês vazio usa a soma).
- Diagnóstico do histórico: verificar se `loadReportExtras` busca `commercial_history_monthly` no caminho usado pelo botão do relatório geral e se a condição de "2 ou mais anos" está sendo atendida.

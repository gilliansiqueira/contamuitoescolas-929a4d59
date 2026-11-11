# Receitas do ano todo no relatório da Joinville Norte

## O que encontrei
- A Norte só tem lançamentos na plataforma a partir de setembro/2026. Por isso a página "Evolução de receitas" mostra só setembro e outubro.
- O seu PDF de agosto traz as receitas de janeiro a agosto/2026, com total de R$ 1.277.884,96 (ex.: agosto R$ 143.268,38).
- As três páginas novas de histórico comercial (receptivos, ativos, matrículas) também não apareceram no PDF que você mandou.

## O que vou fazer
1. **Gravar jan–ago/2026 da Norte a partir do seu PDF**, mês a mês, conferindo que a soma dá exatamente R$ 1.277.884,96. Fica salvo como histórico da escola, com o nome do arquivo de origem.
2. **Evolução de receitas no relatório**: meses sem lançamentos na plataforma usam esse histórico; meses com lançamentos continuam vindo do cálculo oficial (nunca os dois no mesmo mês). Uma nota avisa quais meses vieram do histórico.
3. **Páginas de histórico comercial**: gerar o relatório aqui, achar por que não entraram e corrigir.
4. **Conferir o PDF gerado** de out/2026 da Norte: receitas de jan a out e as três páginas de histórico.

## Detalhes técnicos
- Nova tabela pequena `revenue_history_monthly` (school_id, month, value, source_kind, source_file, imported_at), mesmas regras de acesso de `commercial_history_monthly` (incl. RESTRICTIVE `can_see_school`). Valores lidos por posição do rótulo no gráfico (pymupdf) e validados contra o total impresso.
- `Dashboard.tsx` `buildAnnual('receitas')`: quando `buildMonthMovement` retorna `vazio`, usar o histórico do mês; despesas/resultado não mudam. Meses de histórico marcados em `MesCompletoData` para a nota em `mesCompletoPdf.ts`.
- Teste puro da regra (mês com movimento ignora histórico; mês vazio usa histórico).
- Diagnóstico do histórico comercial em `loadReportExtras` e na condição de "2 ou mais anos".

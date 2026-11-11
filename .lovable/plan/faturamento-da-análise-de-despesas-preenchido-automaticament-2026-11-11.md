# Faturamento da Análise de Despesas preenchido automaticamente

## O que muda para a equipe
- Ao abrir a Análise de Despesas, o campo "Faturamento do mês" já aparece preenchido quando ainda não houver valor salvo.
- Ordem de onde vem o valor:
  1. Valor já salvo manualmente no mês (continua valendo, nunca é sobrescrito).
  2. Receita integral informada para o mês (a mesma usada na lucratividade).
  3. Receita total realizada do mês pela plataforma (mesmo número do Dashboard).
- Um selo pequeno ao lado indica a origem: "Receita integral" ou "Receita do mês (plataforma)". A pessoa pode editar e salvar normalmente; o valor salvo passa a mandar.
- Percentuais por categoria, insights ("despesas consomem X% do faturamento") e o PDF passam a usar esse valor quando não houver um salvo.
- Vale para todas as empresas, incluindo a Quintal.

## Observação
Hoje só 6 empresas têm receita integral preenchida (out/2026), por isso o passo 3 (receita do mês da plataforma) cobre as demais.

## Detalhes técnicos
- `RelatorioRealizado.tsx` (e `.quintal.tsx`): `currentRevenue` = `monthly_revenue` salvo → `useIntegralRevenue(schoolId)[mes]` → receita do `buildMonthMovement` (mesma fonte do `useAutoProfitability`, sem recalcular). Nada é gravado automaticamente em `monthly_revenue`.
- Input mostra o valor sugerido com o selo de origem; salvar grava como hoje.
- Período com vários meses: soma por mês usando a mesma prioridade.
- Teste pequeno da regra de prioridade em `src/test/`.

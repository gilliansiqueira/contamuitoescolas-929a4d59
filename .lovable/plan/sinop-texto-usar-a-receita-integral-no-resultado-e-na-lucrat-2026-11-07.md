# Sinop: texto usar a receita integral no resultado e na lucratividade

## Resposta direta
Escrever nas orientações **não basta**: a IA só pode usar números que a plataforma entrega, e hoje o texto recebe a receita integral apenas numa linha de lucratividade. As linhas de Receitas e Resultado continuam com a receita recebida. Depois da correção, basta clicar de novo em "Gerar texto do Relatório" ali mesmo.

Confirmado: Sinop tem receita integral salva para outubro/2026 (R$ 152.788,43).

## O que muda
- Quando a empresa tiver receita integral salva no mês, o topo do texto passa a ser:
  - **Receitas (integral):** valor salvo
  - **Despesas:** as mesmas da plataforma
  - **Resultado:** receita integral menos despesas
  - Uma linha extra com a receita efetivamente recebida, explicando a diferença (antecipações).
- **Lucratividade:** calculada sobre a receita integral, como principal.
- O cálculo da lucratividade integral passa a sair dos mesmos totais do mês usados no texto, sem depender de outra carga da tela — corrige o caso em que ela não aparecia.
- Empresas sem receita integral: nada muda (mantêm os dois cenários quando houver).

## Detalhes técnicos
- `buildReportFacts` recebe `receitaIntegral?: number`; se > 0, usa `integralClosing` (`src/lib/profitability.ts`) para gerar as linhas de título, a linha "Receita recebida no mês" e a lucratividade integral via `computeProfitability`.
- `ReportChecklist.tsx` passa `integral[month]` para `buildReportFacts`; `profitabilityFacts` deixa de gerar a linha integral nesse caso (evita duplicar).
- Prompt da Edge Function: "se houver Receitas (integral), use-a nas três linhas do topo".
- Teste: com receita integral de R$ 152.788,43, o topo mostra esse valor e o resultado = integral − despesas.

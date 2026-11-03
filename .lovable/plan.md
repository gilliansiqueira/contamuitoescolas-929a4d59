# Rondonópolis: histórico de 2025 e jan–ago/2026, saldo e lucratividade

## Fontes
- **Receitas:** balancetes do Sponte de 2025 e de jan–ago/2026.
- **Despesas:** Análise de Despesas da plataforma. Em 2026 entram também as taxas de cartão e as devoluções de cheques que faltavam (R$ 37.510,21). Em 2025 a mesma conferência é feita antes, e eu mostro as diferenças.
- **Divisão de Lucros:** fica fora do resultado e da lucratividade, mas reduz o saldo. Foram R$ 1.055.831,27 em 2025 e R$ 426.285,52 de jan a ago/2026.
- **Saldo:** R$ 328,72 em conta corrente em 01/01/2026 (extratos de dezembro) e R$ 81.619,16 em 31/08/2026 (Fluxo Bancário, confirmado).

## Passos
1. **Conferir 2025:** comparar categoria por categoria as despesas do balancete com a Análise de Despesas e listar as diferenças para você aprovar.
2. **Histórico mensal (01/2025 a 08/2026):** receita, despesa, distribuição de lucros e resultado de cada mês.
3. **Saldo, opção A:**
   - 2026: sai de R$ 328,72 e chega em R$ 81.619,16. A diferença entra como "Ajuste de caixa (aplicações, resgates, transferências)", distribuída pela planilha bancária revisada. É só caixa, nunca resultado.
   - 2025: calculado para trás a partir de R$ 328,72 com receita − despesa − distribuição. Se aparecer um saldo absurdo, eu aviso antes de gravar e usamos os extratos de dez/2024 para fechar.
4. **Lucratividade nos Indicadores:** gravar a lucratividade de cada mês, de 01/2025 a 08/2026, no indicador "Lucratividade" de Rondonópolis. Cálculo: (receita − despesa sem Divisão de Lucros) ÷ receita. Ela aparece nos Indicadores e no painel.
5. Antes de gravar, mostro a tabela final: mês, receita, despesa, resultado, lucratividade, distribuição, ajuste e saldo.

## Depois, com calma
- Para os meses do meio fecharem no valor exato, precisamos do saldo aplicado (BB Rende Fácil e fundos do Sicredi) no fim de cada mês. O OFX normalmente também não mostra esse saldo. O melhor é o **extrato de investimentos/aplicações** de cada banco, ou o resumo de saldo do fim do mês no internet banking.

## Detalhes técnicos
- `historical_monthly` só de Rondonópolis, meses 2025-01 a 2026-08: `receita`, `despesa`, `distribuicao de lucros` e `ajuste de caixa`. O ajuste é classificado como operação na SSOT e afeta só o Caixa.
- `kpi_values` do indicador "Lucratividade" da escola, um valor por mês, substituindo só esses meses.
- Nada de outras escolas ou de outros meses é alterado. Nada é gravado sem a sua aprovação da tabela.

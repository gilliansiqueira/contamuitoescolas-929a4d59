# Relatório semestral Champagnat – 1º semestre/2026

## O que será entregue
Um PDF com os mesmos 19 slides do modelo do Canva, no mesmo visual (fundo grafite, título branco grande, faixa verde-água, barras 3D laranja e verde, logo Conta Muito no canto). O período é jan–jun/2026. É um arquivo único, salvo em Arquivos, sem mudar nada no sistema.

## Slides (mesma ordem do modelo)
1. Capa/resumo: saldo inicial, receitas, despesas, resultado, aporte p/ CR, saldo final
2. Saídas por categoria
3. Saídas x Faturamento (% e legenda com os limites: Fixas 15%, Gerais 10%, Pessoal 35%, Impostos 10%, Publicidade 5%, Franqueadora 25%)
4. Despesas Fixas (itens + total)
5. Despesas Gerais
6. Comparação Fixas/Gerais: 1º sem 2025, 2º sem 2025, 1º sem 2026
7. Pessoal
8. Impostos
9. Comparação Pessoal/Impostos (3 semestres)
10. Franqueadora
11. Publicidade (com %)
12. Comparação Franqueadora/Publicidade (3 semestres)
13. KPIs: ticket médio semestral/mensal, ponto de equilíbrio, lucratividade
14. Histórico de KPIs: 1º sem 2024 até 1º sem 2026
15. KPIs: desconto, inadimplência, alunos por turma, evasão (atual x 1º sem 2025)
16. Histórico desses KPIs
17. Comercial: contatos, matrículas, conversão, custo por lead
18. Histórico comercial
19. Comparação semestral: de 1º sem/2021 até 1º sem/2026

## De onde vêm os números
- **Histórico (até 2º sem/2025):** copiado do PDF do Canva, sem alteração.
- **1º sem/2026:** tirado do sistema da Champagnat (os 6 meses estão lançados: 453 lançamentos e indicadores), usando os mesmos totais que o Relatório Realizado mostra. Nada é recalculado por regra própria.
- Despesas são somadas pelas mesmas categorias do modelo. Se algum item não se encaixar, eu aviso qual é.
- KPIs semestrais: os percentuais (desconto, inadimplência, evasão) e alunos/turma são a média dos 6 meses. Contatos e matrículas são a soma dos meses. Ticket mensal = receita ÷ 6 ÷ alunos médios.

## Pontos a confirmar na entrega
- **Saldo inicial/final e "Aporte p/ CR":** vêm do saldo do Caixa no sistema. Se não houver aporte no semestre, o valor aparece zerado.
- Qualquer número de 2026 que pareça fora do normal será listado, com os lançamentos que o explicam.

## Detalhes técnicos
- Script Python (matplotlib + reportlab) em /tmp, em formato 16:9. Logo de `src/assets/logo-conta-muito.png`.
- Consultas somente leitura em `realized_entries`, `monthly_revenue`, `kpi_values` e nos dados comerciais/conversão da escola `992d3914…`, de 2026-01 a 2026-06. Os totais serão conferidos com o Relatório Realizado de cada mês.
- Saída: `/mnt/documents/Champagnat_1_Semestre_2026.pdf`. Cada página vira imagem e é conferida antes da entrega.
- Nenhuma alteração de código ou banco.

# Relatório Joinville Centro e Norte no modelo enviado

## O que vai mudar
Um novo PDF, que só aparece para Joinville Centro e Joinville Norte, com o mesmo conteúdo do modelo de Agosto/2026, mas no visual da plataforma (claro, verde e laranja). O "Relatório geral" das outras escolas continua igual.

Páginas do novo PDF (uma por tema):
1. **Receitas por categoria**: Turma, Reposição, Matrícula, Material, Juros/Multa, Outras e o total do mês.
2. **Entradas x faturamento**: percentual de cada categoria.
3. **Receitas no ano**: barras de jan a dez e o total do ano.
4. **Vendas por forma de pagamento**: Crédito, Débito, Link, Cheques, Boletos e PIX, com totais.
5. **KPIs**: média de desconto, inadimplência, alunos por turma, evasão e formas de pagamento, comparando com o mês anterior.
6. **Comercial receptivo** e **comercial ativo**: contatos, matrículas e conversão.
7. **Histórico desde 2020**: contatos receptivos, contatos ativos e matrículas, com uma linha por ano e o total de cada ano.

Todos os números do mês vêm do que a plataforma já calcula hoje. Nada é recalculado à parte.

## Histórico na plataforma
- O histórico mensal de 2020 a 2025 (contatos receptivos, contatos ativos e matrículas) fica salvo por escola.
- Vocês me mandam os PDFs antigos de cada escola. Eu leio os gráficos e mostro uma prévia por ano e por mês para você conferir antes de salvar.
- Também vai dar para corrigir esses números à mão.
- De 2026 em diante, o histórico vem do que já está lançado na plataforma.

## O que preciso de você
- O PDF mais recente da Joinville Centro e de preferência um da Norte com dezembro de cada ano, porque os gráficos mostram todos os anos de uma vez.
- Se algum número estiver ilegível no gráfico, ele fica em branco e eu aviso. Nada é inventado.

## Detalhes técnicos
- Nova tabela `commercial_history_monthly` (school_id, ano, mês, métrica, valor, origem, upload_id), com RLS para a equipe e a política RESTRICTIVE `can_see_school`.
- Novo gerador de PDF ao lado de `mesCompletoPdf`, liberado por `school_features` para as duas escolas. Os dados vêm do mesmo `buildData` (SSOT).
- A importação do histórico grava com rastreio de origem, e apagar um upload apaga os valores ligados a ele.
- Os testes cobrem a montagem dos dados por página e a junção do histórico com os dados de 2026.

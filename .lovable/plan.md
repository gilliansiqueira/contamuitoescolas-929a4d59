# Lucratividade em Lauro de Freitas

Hoje Lauro de Freitas só tem quatro indicadores (Evasão, Inadimplência, Média de alunos por turma e Média de desconto). Não tem nenhum de lucratividade, por isso ela não aparece no relatório.

## O que será feito
1. Criar dois indicadores, iguais aos das outras escolas:
   - **Lucratividade operacional** (sem as Operações)
   - **Lucratividade total** (com as Operações)
2. A partir de outubro/2026, eles passam a ser preenchidos sozinhos pela regra automática, como nas outras escolas. Os dois cenários entram no texto do relatório.
3. **Meses anteriores:** calcular os meses fechados que têm dados na plataforma (maio a setembro/2026), com a mesma regra do Dashboard, e gravar esses valores nos indicadores. Antes de maio não há lançamentos, então esses meses ficam em branco.
4. Conferir o resultado de setembro e outubro na tela Indicadores e no Dashboard, para garantir que mostram o mesmo número.

## Detalhes técnicos
- Inserir em `kpi_definitions` (school_id `916f7764-…`) dois registros com `auto_key` `lucro_operacional` e `lucro_total`, percentual, 2 casas, `higher_is_better`, mesmo ícone das outras escolas.
- Para os meses retroativos, rodar `computeProfitability` (`src/lib/profitability.ts`) sobre os totais do `buildMonthMovement` de cada mês, via Playwright logado no app, e gravar em `kpi_values`. Pular qualquer mês que estiver fechado e avisar.
- Sem mudança de código nem de regra financeira.

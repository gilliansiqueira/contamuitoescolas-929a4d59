# Planilha da revista: Cuiabá Jardim Itália (piloto)

## O que vou entregar
Um arquivo Excel com todo o histórico da escola que existe no sistema, organizado para outro chat ler com facilidade: uma informação por coluna, sem células mescladas e com os meses no formato AAAA-MM. Ele fica disponível em Arquivos para você baixar.

Abas:
1. **Leia-me**: nome da escola, período coberto, de onde vem cada número e um glossário com termos como Resultado, Operações e Ticket médio.
2. **Resumo mensal**: uma linha por mês com Receita, Despesa, Resultado e margem. Os números vêm dos mesmos totais oficiais que o Dashboard mostra.
3. **Receitas por categoria** e **Despesas por categoria**: mês, categoria e valor, para rankings como as maiores despesas.
4. **Indicadores**: mês, indicador, valor, meta e unidade. Inclui alunos, evasão, inadimplência e o que estiver cadastrado.
5. **Comercial**: conversão por origem (contatos e matrículas), vendas e produtos mais vendidos, quando existirem.
6. **Destaques**: melhor mês de receita, crescimento no ano, maior categoria de despesa e indicadores que bateram a meta. Ajuda a montar as manchetes da revista.

## Regras
- Só leitura: nada é alterado no sistema.
- Valores em reais com duas casas. Abas sem dados ficam vazias, com um aviso.
- Antes de entregar, comparo os totais de alguns meses com o que aparece no Dashboard.

## Próximo passo
Você revisa o arquivo e, se aprovar, gero o mesmo formato para as outras escolas, um arquivo por escola ou um único arquivo com todas.

## Detalhes técnicos
- Leitura no banco (`realized_entries`, `financial_entries`, `kpi_values`/`kpi_definitions`, `conversion_data`, `sales_data`, `product_sales_monthly`, `monthly_revenue`, `historical_monthly`), filtrada pelo `school_id` da escola.
- Classificação Receita/Despesa/Operação/Ignorar segue `tipoMeta`/`classificationUtils`, nunca o sinal do valor. Operações e Ignorar ficam fora do Resultado.
- Geração com openpyxl em /tmp; salvo em `/mnt/documents/revista_cuiaba_jardim_italia.xlsx`.

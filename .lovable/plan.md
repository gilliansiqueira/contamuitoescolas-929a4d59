# Relatórios por etapa e filtros da conciliação

## Objetivo
- Na aba **Relatórios** da Central, substituir os cards de situação diária por um resumo curto de onde está cada relatório mensal.
- Em **Fluxo Bancário → Movimentações**, permitir ver separadamente receitas e despesas, sem alterar a classificação nem os saldos.

## Relatórios
- Exibir seis cards compactos: **Projeção**, **Análise de despesas**, **KPIs**, **Vendas e receitas**, **Contatos e matrículas**, **Texto e entrega**. Vendas e receitas ficam juntas somente no resumo; o passo a passo detalhado continua separado dentro de cada empresa.
- Cada empresa conta em **uma única etapa atual**: o primeiro grupo com trabalho pendente, na ordem do relatório. O card mostra quantas empresas estão naquele passo e quantas ainda faltam concluí-lo; clicar mostra somente essas empresas. Mostrar à parte as empresas sem etapas geradas e as que já entregaram, para não desaparecerem da contagem.
- O resumo considera o **mês escolhido**, os ajustes de etapas por empresa e os filtros de busca existentes. Se uma etapa for marcada como “Não se aplica”, não fica pendente. A Carteira de clientes e a visão Por responsável mantêm seus cards atuais.
- Na linha de cada empresa em Relatórios, manter a porcentagem e facilitar a abertura do detalhe para ver exatamente quais subetapas faltam.

## Conciliação
- No seletor **Categoria** de Movimentações, manter “Todas” e as categorias especiais e separar a opção conjunta “Entrada / Saída” em **Receitas** e **Despesas**; oferecer também a visão conjunta para quem precisar.
- Filtrar pela **classificação financeira oficial** da fonte única de cálculos, não pelo sinal ou pelo sentido entrada/saída do extrato. Operações, transferências e itens ignorados não devem aparecer indevidamente em Receitas ou Despesas. Lançamentos divididos devem ser tratados com atenção: preservar suas partes e não criar uma classificação fictícia para a linha inteira.
- Resumo, seleção em lote e ações continuam trabalhando apenas sobre as linhas exibidas, sem modificar registros, importações ou regras financeiras.

## Detalhes técnicos
- Reaproveitar `monthly_closing_checklist`, `closing_step_templates` e os ajustes por empresa para derivar o grupo pendente de cada empresa; não usar porcentagens como substituto da etapa real. Paginar a leitura para não limitar a carteira aos primeiros registros e atualizar o resumo após mudanças no checklist.
- Na tabela bancária, reutilizar a classificação da SSOT aplicada aos lançamentos do Fluxo Bancário; manter os filtros como visualização, sem novas heurísticas financeiras. Não é necessária migration para a interface proposta.

## Conferência
- Conferir, em uma empresa real, os cards e seus filtros antes e depois de marcar uma etapa, inclusive “Não se aplica”, empresas sem etapas e relatórios entregues.
- Conferir Receitas, Despesas e a visão conjunta com lançamentos normais, operação, transferência, ignorado e dividido; confirmar que nenhuma quantia ou conciliação muda ao alternar filtros.
- Revisar a tela no computador e celular antes de encerrar. A publicação no site oficial não faz parte desta mudança sem pedido explícito.
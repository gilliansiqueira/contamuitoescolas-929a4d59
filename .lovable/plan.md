# Importar os dados da Quintal de Casa

A pasta serve. Ela tem as 20 tabelas pedidas, já com o identificador da Quintal daqui, e traz duas conferências por mês (realizado e fluxo de caixa) para comparar depois da importação. Os saldos dos bancos podem ficar para a Isa preencher depois.

## O que já existe aqui
A Quintal já tem nesta plataforma uma parte dos dados, de uma carga antiga: 11.382 lançamentos realizados (jan/2024 a set/2026), plano de contas, indicadores, histórico e faturamento de 12 meses. A pasta nova é mais completa: 11.663 realizados, 4.613 lançamentos de fluxo/projeção, 2.151 itens de centro de custo, 286 passeios, 2 CNPJs com rateio mensal e 22 meses de faturamento.

## Como vou fazer
1. **Comparar antes de gravar:** cruzar cada linha que já existe aqui com a pasta, pelo identificador. Os dois projetos são cópias, então os identificadores devem ser os mesmos.
2. **A pasta vale como versão oficial:** linhas que estão nos dois lugares são atualizadas, e linhas novas entram. Linhas que só existem aqui serão listadas para você antes de qualquer remoção. Nada é apagado sem essa lista.
3. **Ordem de gravação:** CNPJs e rateio, plano de contas, grupos de centro de custo, envios de arquivo, lançamentos (fluxo e realizado), itens e passeios, indicadores, faturamento, recebíveis, histórico e premissas da simulação. Os saldos dos bancos que vieram na pasta (5 contas) também entram. A Isa ajusta depois.
4. **Conferência:** total e quantidade por mês, comparados com os dois arquivos de conferência da pasta. Se houver diferença, aponto as linhas exatas.
5. **Fluxo Bancário:** fica liberado, mas só será ativado em novembro/2026 quando a Isa cadastrar as contas e os saldos de 31/10.

## Fica de fora
Usuários e senhas (não vieram na pasta), modelos gerais compartilhados (os daqui já são os mesmos) e as tabelas vazias.

## Detalhes técnicos
- Gravação em lotes pelas ferramentas de dados, em ordem de dependência, com os mesmos identificadores. Upsert pelo identificador, e as colunas que não existem aqui são ignoradas.
- O saldo inicial de R$ 482.185,52 da Quintal é mantido ou ajustado conforme a pasta.
- O ícone do indicador vai para o armazenamento, e o endereço é atualizado.

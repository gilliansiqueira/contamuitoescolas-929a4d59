# Plataforma mais rápida e ágil

## Diagnóstico confirmado

- As consultas mais pesadas leem todos os lançamentos de uma empresa repetidamente:
  - `financial_entries`: 156.716 registros na base; consultas chegam a 7,5 segundos e se repetiram mais de 11 mil vezes.
  - `realized_entries`: 122.442 registros; consultas chegam a 7,2 segundos.
- A paginação atual busca blocos sucessivos até baixar todo o histórico, mesmo quando a pessoa escolheu poucos meses.
- Algumas telas fazem consultas próprias para os mesmos dados, em vez de compartilhar o resultado já carregado.
- O aplicativo importa todas as telas e recursos pesados logo na abertura, incluindo gráficos, configurações e geradores de PDF que o cliente talvez nem use naquela sessão.
- O cache geral está sem configuração: ao voltar para uma tela ou focar novamente o navegador, dados grandes podem ser solicitados outra vez.
- Já existem bons índices para histórico e para combinações de empresa/data nas duas tabelas principais. Portanto, o primeiro ganho deve vir de reduzir volume e repetição; qualquer índice adicional só será criado após medir o plano real da consulta.
- A leitura de saúde do serviço expirou durante a análise. Isso confirma instabilidade naquele instante, mas não é suficiente para concluir que seja necessário aumentar a capacidade do serviço.

## Etapa 1 — ganho imediato na navegação

- Carregar sob demanda somente a aba que o cliente abriu, deixando gráficos, configurações, importações e PDFs fora do carregamento inicial.
- Importar os geradores de PDF apenas quando o botão de exportação for acionado.
- Configurar o cache dos dados por empresa, evitando novas leituras ao alternar abas ou retornar à janela.
- Manter atualização explícita após importações, edições, exclusões e fechamentos para nunca exibir números antigos.
- Eliminar consultas duplicadas com chaves padronizadas e dados compartilhados entre Dashboard, Comparativo e Realizado.
- Paginar ou virtualizar tabelas extensas, para que o navegador não tente desenhar milhares de linhas ao mesmo tempo.

## Etapa 2 — buscar somente o período necessário

- Aplicar o período selecionado diretamente nas consultas de lançamentos financeiros e realizados.
- Separar duas necessidades:
  - telas financeiras recebem somente os registros do período visível;
  - seletores de mês recebem apenas uma lista leve de meses disponíveis, sem baixar lançamentos completos.
- Para relatórios amplos e exportações, buscar o intervalo completo somente no momento da solicitação.
- Selecionar apenas as colunas usadas por cada tela, em vez de carregar registros completos indiscriminadamente.
- Agrupar os lançamentos por mês uma única vez antes das comparações, evitando percorrer todo o histórico novamente para cada mês.
- Preservar integralmente a fonte única dos cálculos: os mesmos motores oficiais continuarão classificando e consolidando os dados.

## Etapa 3 — banco de dados e escalabilidade

- Medir as consultas principais com o plano real de execução depois da redução de volume.
- Confirmar o uso dos índices existentes de empresa + data + identificador.
- Criar por migration somente índices comprovadamente necessários; provável foco em consultas por empresa e ordenação das tabelas auxiliares.
- Verificar novamente saúde, memória e conexões em horário de uso real.
- Considerar aumento da capacidade do Lovable Cloud apenas se memória ou conexões continuarem saturadas após as correções — aumentar capacidade não corrige downloads desnecessários da tela.

## Etapa 4 — validação objetiva

- Medir antes e depois: abertura inicial, troca entre abas, mudança de período e troca de empresa.
- Testar empresas pequenas e as maiores bases, incluindo Dourados.
- Confirmar que receitas, despesas, resultado e saldos são idênticos antes e depois em períodos equivalentes.
- Testar computador e celular, rede rápida e rede limitada.
- Confirmar que importações e exclusões atualizam imediatamente todas as telas relacionadas.
- Reconsultar as consultas lentas para comprovar redução de chamadas e tempo total.

## Resultado esperado

- A primeira tela aparece mais cedo.
- Trocar de aba não provoca novos downloads completos.
- Alterar o período movimenta apenas os dados necessários.
- Empresas com muito histórico deixam de travar o navegador.
- Nenhuma regra financeira, histórico ou rastreabilidade é alterada.

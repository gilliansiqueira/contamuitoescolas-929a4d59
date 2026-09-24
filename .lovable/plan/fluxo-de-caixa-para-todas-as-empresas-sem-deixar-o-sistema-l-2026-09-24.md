# Fluxo de Caixa para todas as empresas, sem deixar o sistema lento

## O que o diagnóstico mostrou

- O servidor do banco de dados está saudável: memória em 45%, disco em 6%, conexões baixas (15 de 60) e nenhuma reinicialização. A lentidão **não é falta de capacidade do servidor**. Ainda não é hora de pagar por um servidor maior.
- A lentidão vem da forma como as telas buscam os dados. Hoje são 55 empresas e cerca de 156 mil lançamentos. Ao abrir uma empresa, o sistema baixa **todos os lançamentos dela, de todos os anos**, em várias partes seguidas. Cada parte leva em média 0,5 segundo e às vezes até 7 segundos. Cada parte seguinte fica mais lenta que a anterior.
- Algumas buscas não têm um "atalho" (índice) no banco. É o caso do plano de contas por empresa e dos lançamentos ordenados de outra forma.
- Quando várias pessoas abrem empresas grandes ao mesmo tempo, essas buscas pesadas se acumulam. Por isso o sistema parece "sair do ar".

Conclusão: se ligarmos o Fluxo de Caixa para as 55 empresas antes de resolver isso, o problema piora. A proposta é fazer em **duas fases**: primeiro deixar o sistema leve, depois liberar o fluxo em ondas.

## Fase 1: deixar o sistema rápido (antes de expandir)

1. **Criar os atalhos que faltam no banco** para lançamentos, realizado e plano de contas por empresa. Isso dá ganho imediato e não altera nenhum dado.
2. **Trocar a forma de paginar.** Em vez de "pule 5.000 e traga os próximos", o sistema passa a pedir "traga os próximos a partir do último que recebi". Assim, cada parte leva o mesmo tempo, por maior que seja a empresa.
3. **Buscar só as colunas necessárias** em vez de todas.
4. **Guardar em memória o que já foi carregado.** Trocar de aba ou voltar para uma empresa não baixa tudo de novo. Os dados são atualizados em segundo plano e sempre que alguém importa, classifica ou concilia algo.
5. **Carregar primeiro o período em uso** (ano atual e anterior) e trazer o histórico antigo só quando uma tela precisar dele. Os totais e saldos continuam vindo dos mesmos motores oficiais, sem nenhum cálculo novo.
6. **Medir antes e depois.** O teste usa Dourados, Portão e a maior empresa, comparando tempo de abertura e volume de dados baixados. Os valores do Dashboard, do Fluxo Diário e dos PDFs precisam sair idênticos aos de antes.

## Fase 2: liberar o Fluxo de Caixa para todas, em ondas

Valem as mesmas regras aprovadas no piloto: banco + lançamentos da equipe; Ignorar mexe no saldo e fica fora do Resultado; operações só no Caixa; nada antes da competência inicial é alterado; troca reversível; Análise de Despesas continua separada.

1. **Ligar a aba Fluxo Bancário para todas as empresas** com status **Rascunho**. Nada muda para os clientes, e o Dashboard continua usando a planilha.
2. **Ondas de cerca de 10 empresas.** As meninas sobem os extratos, e cada empresa passa por **Em conferência** e pela prévia (saldo inicial, movimento e saldo final precisam bater). Depois disso, você aprova com **Aprovar e ativar**.
3. **Painel de acompanhamento na Central:** para cada empresa, o status do fluxo (Rascunho, Em conferência, Ativo ou Pausado), a data da última sincronização e as pendências de classificação.
4. **Sincronização leve:** ao importar um extrato, só as linhas novas são processadas, e somente daquela empresa. Nada é reprocessado para todas.
5. **Olhar a saúde do sistema entre uma onda e outra.** Um servidor maior só entra em discussão se os números mostrarem necessidade.

## Sobre "tempo real"

Com a Fase 1, a atualização continua imediata após cada importação ou classificação, e as telas passam a abrir rápido. Sugestão de como falar com os clientes: "atualizado a cada movimentação importada", mostrando a data e a hora da última atualização, que já existe.

## Detalhes técnicos

- Índices: `financial_entries (school_id, id)`, `chart_of_accounts (school_id)` e revisão dos demais filtros por `school_id` (`historical_monthly`, `kpi_values`, `sales_*`). Também remover o índice duplicado `idx_fe_origem_upload_id`/`idx_financial_entries_upload`.
- Paginação por chave (`data,id > último`) em `useFinancialData` e nos hooks de realizado, no lugar de `range()`/OFFSET. Com isso, o carregamento progressivo termina bem mais rápido.
- React Query com `staleTime` e invalidação disparada por importação, classificação ou conciliação. Nada vai para `localStorage`.
- Nenhuma mudança em projectionEngine, ledgerEngine, classificationUtils ou tipoMeta. É apenas transporte de dados.
- Rollout: `school_features.cashflow_bank_pilot` para todas e `school_data_sources` com status `rascunho`. A ativação continua manual, por empresa.

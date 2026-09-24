# Fluxo de Caixa alimentando Dashboard e Fluxo Diário (piloto) — estrutura e conferência, sem ativação

## Resumo do que já existe
- O Fluxo de Caixa fica na tabela de movimentações bancárias, uma linha por lançamento do extrato. Cada linha é vinculada à escola pelo `school_id`, e as divisões ficam em uma tabela separada.
- Tudo o que está no Fluxo de Caixa é realizado. As previsões continuam vindo dos uploads atuais: Sponte, cartão, cheque e contas a pagar.
- O Dashboard e o Fluxo Diário leem os lançamentos financeiros pelo motor oficial. Os meses com "fluxo realizado" usam esse realizado mais as previsões a partir de hoje.
- Extratos novos disponíveis: 01/09 a 24/09/2026, nas três escolas. As planilhas de fluxo realizado cobrem de junho a setembro.

## Respostas às confirmações

**2. Saldo inicial histórico.** Cada conta tem um saldo de abertura guardado com data, e não o saldo de hoje. Todas as contas estão com a posição de 31/08/2026: em conta e aplicado separados. Alguns exemplos:
- BB de Dourados: R$ 0,00 em conta e R$ 122.078,73 aplicados.
- BB Centro: R$ 0,00 em conta e R$ 8.007,33 aplicados.
- BB Santa Mônica: R$ 0,00 em conta e R$ 15.945,31 aplicados.

A partir desse ponto, o saldo de cada dia e de cada mês sai da abertura mais as movimentações. Nunca do saldo atual. O saldo final de um dia vira o inicial do dia seguinte, e o final de um mês vira o inicial do mês seguinte.
- Esse saldo passa a ser guardado por data, em uma estrutura própria de saldos por conta. A primeira posição gravada será a de 31/08.
- O valor aplicado entra no saldo, porque o Dashboard trabalha com o caixa total. O detalhe "em conta" e "aplicado" continua visível na conferência.
- **Ponto encontrado:** Uberlândia Santa Mônica tem uma conta chamada "Sicredi Centro", com R$ 5.667,09 em 01/09. É o mesmo nome e o mesmo valor da conta do Centro. Ela vai aparecer na conferência como possível cadastro duplicado, para vocês confirmarem antes da ativação.

**6. Data de corte.** O motor deixa de usar a data de hoje nessas escolas e passa a usar **"Fluxo de Caixa atualizado até"**. Essa data é o último dia com extrato importado em todas as contas ativas da escola. Até esse dia, vale o realizado. Depois dele, a projeção continua. Quando novos dias forem importados, a data avança e o realizado substitui a projeção desses dias, sem duplicar. Se uma conta estiver atrasada, a data fica no dia dessa conta.

## Como vai funcionar

1. **Status da configuração.** Cada escola tem uma configuração com os campos:
   - status: Rascunho, Em conferência, Ativo ou Pausado;
   - fonte do Dashboard e fonte do Fluxo Diário;
   - competência inicial: setembro/2026;
   - data "atualizado até";
   - última atualização;
   - último erro.

   Só o status **Ativo** muda o que o Dashboard e o Fluxo Diário mostram. As três escolas começam como **Em conferência**. Nesse status, a sincronização roda e alimenta apenas a tela de conferência.

2. **Tipo financeiro vinculado ao modelo.** Cada movimentação e cada parte de divisão guarda a **referência ao item do modelo financeiro da escola**, e o nome fica só para exibição. A tela oferece apenas a lista oficial da escola, sem texto livre, e o banco rejeita itens de outro modelo. Algumas movimentações já vêm sugeridas; as demais ficam como "A classificar".
   - **Neutras no consolidado:** transferências entre contas próprias com as duas pontas identificadas, e aplicações ou resgates automáticos do principal.
   - **Rendimento da aplicação:** entra como Rendimento.
   - **IOF, imposto, tarifa ou taxa:** entram no tipo correspondente. Quando não houver sugestão segura, ficam "A classificar".
   - **Empréstimo, aporte e retirada:** operações fora do resultado, como hoje.
   - **Transferência com uma só ponta identificada:** não é tratada como neutra. Fica como pendência na conferência e continua contando no saldo.
   - **Movimentação original:** sempre preservada para auditoria, mesmo quando não gera linha no consolidado.

3. **Linhas divididas.** Cada parte gera sua própria linha e o valor total não gera linha. A divisão só é sincronizada quando a soma das partes é exatamente igual ao valor do banco. Se não fechar, a movimentação fica marcada "Divisão com diferença de R$ X" para a equipe. Alterar ou excluir uma parte recalcula todas as linhas dessa movimentação. Lançamentos sem divisão e partes de divisão têm proteções contra duplicidade separadas.

4. **A classificar.** O lançamento entra no saldo. O Dashboard e o PDF ganham uma linha própria, **"Movimentações em classificação: R$ X"**, que só aparece quando houver valor. A conta sempre fecha:

   Saldo inicial + Resultado + Operações fora do resultado + Movimentações em classificação = Saldo final

   A equipe também vê um aviso com quantidade, valor e link. Quando a equipe classifica, o valor sai dessa linha e entra no tipo certo, e o saldo final não muda.

5. **Sincronização automática.** Importar, editar, dividir, reclassificar ou excluir uma movimentação atualiza as linhas geradas daquele dia. A atualização pode ser repetida sem duplicar nada. Ela grava data e hora da última atualização e mostra os erros à equipe. A conciliação não altera nenhum valor.

6. **Selo no Dashboard.** Aparece só quando o status é Ativo: "Atualizado automaticamente pelo Fluxo de Caixa até DD/MM/AAAA às HH:MM".

7. **Tela de conferência (só equipe),** dentro do Fluxo Bancário, para 01/09 a 24/09. Compara o Fluxo de Caixa novo, a planilha de fluxo realizado atual e o que o Dashboard e o Fluxo Diário mostrariam se a fonte estivesse ativa:
   - por escola, por conta, por dia e por tipo de entrada e saída;
   - quantidade de lançamentos, entradas, saídas, saldo inicial e saldo final;
   - transferências, com as pontas pendentes;
   - aplicações e resgates;
   - valores A classificar e divisões com diferença;
   - lançamentos pendentes de conciliação;
   - lista detalhada das divergências, linha a linha: o que existe só na planilha, só no extrato, com valor ou data diferente, ou em duplicidade.

## Testes sem afetar dados reais
- Os testes de inclusão, edição, divisão, conciliação, previsão virando realizado, exclusão e troca de escola rodam **dentro de uma transação que é desfeita no final**. Nenhum lançamento de teste fica gravado.
- Depois, é feita só a leitura com os dados reais das três escolas.
- Também será confirmado que as demais empresas e a Análise de Despesas não mudaram.

## Etapas desta entrega
1. Criar a estrutura: configuração com status, saldos por conta e data, referência ao tipo financeiro e vínculo das linhas geradas com a movimentação ou a parte.
2. Criar a sincronização automática e o corte por "atualizado até" no motor oficial, valendo só para o status Ativo.
3. Colocar o seletor de tipo financeiro, a classificação em lote, o aviso e a linha "em classificação".
4. Criar a tela de conferência.
5. Deixar as três escolas Em conferência, sincronizar setembro e apresentar a conferência a vocês.

A ativação fica fora desta entrega. Ela só acontece depois que vocês aprovarem os números, com as divergências e o saldo inicial resolvidos. Junho a agosto continuam vindo das planilhas.

## Detalhes técnicos
- Nova tabela `school_data_sources(school_id pk, status text check in ('rascunho','em_conferencia','ativo','pausado'), dashboard_source, daily_flow_source, start_month, synced_through date, last_synced_at, last_error)`, com GRANT, leitura via `user_has_school_access` e escrita só para admin. Seed das 3 escolas com `em_conferencia` e `2026-09`.
- Nova tabela `bank_account_balances(account_id, school_id, data, saldo_conta, saldo_aplicado, origem)`, com unique `(account_id, data)` e seed a partir de `bank_accounts.saldo_inicial*`.
- `bank_transactions.model_item_id uuid null` e `bank_transaction_splits.model_item_id uuid null`, com FK para `financial_model_template_items`. Um trigger valida que o item pertence a `schools.financial_model_template_id`.
- `financial_entries`: novas colunas `bank_transaction_id uuid null` e `bank_split_id uuid null`. Índices únicos parciais: `(bank_transaction_id) where bank_split_id is null` e `(bank_split_id) where bank_split_id is not null`. Linhas geradas com `origem='fluxo'`, `source_kind='bank_cashflow'`, `tipo_registro='realizado'`, `tipo_original` igual ao nome do item ou "A classificar".
- Função `sync_bank_cashflow_entries(_school_id, _date)`, security definer e idempotente, com delete e reinsert por movimentação. Chamada por triggers AFTER em transações e splits, roda para os status em_conferencia e ativo; atualiza `synced_through` e `last_synced_at`, e grava erros em `last_error`.
- Quando o status não é ativo, as linhas `bank_cashflow` são ignoradas pelo carregamento. Quando é ativo, nos meses a partir de `start_month`, o carregamento ignora `origem='fluxo'` com `source_kind<>'bank_cashflow'` e usa `synced_through` no lugar de hoje como corte de projeção em `periodMovement`. Os motores oficiais continuam sem duplicação.
- "A classificar" entra no `tipoMeta` como classificação própria que impacta caixa e fica fora do resultado. O sinal vem do sentido bancário. O item aparece no Dashboard e no PDF como linha de ajuste.

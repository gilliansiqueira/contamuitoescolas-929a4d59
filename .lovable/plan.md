# Fluxo de Caixa alimentando Dashboard e Fluxo Diário (Dourados, Uberlândia Centro e Uberlândia Santa Mônica)

## O que existe hoje

| Pergunta | Resposta |
|---|---|
| Onde ficam os lançamentos do Fluxo de Caixa | Na tabela de movimentações bancárias, uma linha por lançamento do extrato. As divisões ficam em uma tabela à parte. |
| Campo da empresa | `school_id` (é o "company_id" da plataforma), presente em todas as linhas e protegido por permissão. |
| Realizado x projetado | No Fluxo de Caixa tudo é **realizado**, porque vem do extrato. Ele não tem lançamentos projetados. As previsões continuam vindo dos uploads atuais (Sponte, cartão, cheque e contas a pagar). |
| Categorias | O Fluxo de Caixa só marca a **natureza** do lançamento: normal, operação, ignorar, transferência ou aplicação automática. Ele **não guarda o tipo financeiro** que o Dashboard usa (Receita, Despesa, Pró-labore, Rendimentos e similares). |
| De onde o Dashboard e o Fluxo Diário leem | Da tabela de lançamentos financeiros, usando o motor oficial. Quando um mês tem lançamentos "fluxo realizado", o motor já usa esses lançamentos e só considera previsões a partir de hoje. Assim, previsão e realizado não se somam. |
| O que as três empresas têm | Planilhas de fluxo realizado de junho a setembro de 2026, com setembro parcial. No Fluxo de Caixa novo existem apenas extratos de **01/09 a 24/09/2026**. |

Com isso, a integração não precisa de uma lógica nova. O Fluxo de Caixa passa a gerar os mesmos lançamentos "fluxo realizado" que a planilha gera hoje, e o motor oficial faz o resto.

## Como vai funcionar

1. **Tipo financeiro no Fluxo de Caixa.** Cada movimentação e cada parte de uma divisão ganha um campo "Tipo financeiro", com a mesma lista de tipos do Dashboard daquela empresa. O campo vem pré-preenchido quando possível:
   - Transferência entre contas próprias e aplicação ou resgate automático: fora do resultado. Uma transferência se anula entre as contas; aplicação e resgate não mudam o saldo total.
   - Ignorar: Ignorar.
   - Operação: tipo de operação correspondente.
   - Demais lançamentos: ficam como **"A classificar"** até a equipe definir. As meninas podem classificar em lote.

2. **Geração automática.** Sempre que uma movimentação é importada, editada, dividida, reclassificada ou excluída, o banco atualiza os lançamentos "fluxo realizado" da empresa naquele dia. Essa atualização só acontece a partir da competência inicial escolhida.
   - Cada lançamento gerado fica ligado ao `school_id` e ao lançamento bancário que o originou, com origem "Fluxo de Caixa". Uma segunda execução não duplica nada.
   - Divisões geram uma linha por parte.
   - A conciliação não gera nada nem altera valores. Pendente e conciliado entram iguais nos totais.

3. **"A classificar".** O lançamento entra no saldo e nas entradas ou saídas do Fluxo Diário, mas fica fora do Resultado até ser classificado. A equipe vê um aviso com a quantidade e um link para as linhas. O cliente não vê o aviso.

4. **Fonte de dados por empresa.** Uma configuração por empresa guarda:
   - fonte do Dashboard;
   - fonte do Fluxo Diário;
   - competência inicial.

   Nas três escolas, as duas fontes passam a ser "Fluxo de Caixa". A Análise de Despesas não muda. Nos meses a partir da competência inicial, as linhas de planilha de fluxo realizado deixam de ser usadas nos cálculos, mas **não são apagadas**. Os meses anteriores continuam iguais. As demais empresas continuam sem configuração e seguem o processo atual.

5. **Previsão vira realizado.** O motor atual já faz essa troca pela data: nos meses com fluxo realizado, previsões com data anterior a hoje saem da conta. O cartão Sponte e a maquininha continuam com a regra atual.

6. **Selo no Dashboard.** Nas três empresas aparece a frase: "Atualizado automaticamente pelo Fluxo de Caixa até DD/MM/AAAA às HH:MM". A data e a hora vêm da última atualização registrada. Se a geração falhar, a equipe vê um aviso de erro.

7. **Tela de conferência (só equipe),** dentro do Fluxo Bancário. Por mês, lado a lado:
   - receitas, despesas, saldo inicial e saldo final do Fluxo de Caixa;
   - os mesmos valores calculados para o Dashboard e para o Fluxo Diário;
   - quantidade de lançamentos realizados, projetados, pendentes de conciliação e "A classificar";
   - possíveis duplicidades, com as linhas responsáveis quando algo não fechar.

## Decisão antes de ativar

Nada será trocado até você escolher a competência inicial de cada escola. Hoje só setembro/2026 tem extratos no Fluxo de Caixa, e setembro também tem planilha de fluxo realizado até o dia 24. A proposta é começar em **setembro/2026** nas três, depois que a conferência mostrar os valores lado a lado. Os meses de junho a agosto continuam vindo das planilhas.

## Permissões e segurança

- Só a equipe inclui, edita, exclui, classifica e concilia.
- O cliente só vê o Dashboard e o Fluxo Diário, sem controles de conciliação.
- Toda geração e toda leitura são filtradas por `school_id`. Os testes vão confirmar que as três escolas não se misturam, inclusive para quem acessa mais de uma.

## Testes

Os 11 testes pedidos, feitos nas três escolas com lançamentos de teste que depois serão removidos:
- entrada, saída e lançamento pendente;
- conciliar sem mudar valores;
- previsão, depois confirmada como realizado;
- edição e exclusão;
- troca entre escolas;
- outras empresas sem mudança;
- Análise de Despesas intacta.

## Etapas

1. Estrutura: tipo financeiro, ligação com o lançamento bancário, configuração de fonte e registro da última atualização.
2. Geração automática no banco, segura para repetir, e respeito à configuração de fonte no motor oficial.
3. Campo e classificação em lote no Fluxo Bancário, aviso "A classificar" e selo no Dashboard.
4. Tela de conferência e apresentação dos números a você.
5. Após sua aprovação, ativação com a competência escolhida e os testes.

## Detalhes técnicos

- `bank_transactions.tipo_financeiro text null` e `bank_transaction_splits.tipo_financeiro text null`. A lista vem dos tipos do modelo financeiro da escola (`tipoMeta`/`financial_model_template_items`).
- `financial_entries.bank_transaction_id uuid null` e `bank_split_id uuid null`, com índice único parcial para garantir idempotência. Valores fixos: `origem='fluxo'`, `tipo_registro='realizado'`, `source_kind='bank_cashflow'`, `categoria='fluxo_realizado'`, `tipo_original=tipo_financeiro` (ou "A classificar"), `data` = data bancária. Transferência, aplicação e resgate não geram linhas, porque o saldo consolidado não muda.
- Nova tabela `school_data_sources(school_id, dashboard_source, daily_flow_source, start_month, last_synced_at, last_error)`, com GRANT, RLS por `user_has_school_access` para leitura e escrita só para admin.
- Função `sync_bank_cashflow_entries(_school_id, _date)` (security definer), com upsert e delete por vínculo. É chamada por triggers AFTER em `bank_transactions`/`bank_transaction_splits`, só quando existe configuração ativa e a data é igual ou posterior a `start_month`.
- `periodMovement`: nos meses a partir de `start_month` em escolas com fonte "Fluxo de Caixa", entries `origem='fluxo'` com `source_kind<>'bank_cashflow'` ficam fora do cálculo. É um único filtro no carregamento, sem recálculo paralelo.
- "A classificar": `tipoMeta` passa a trazê-lo como impacta caixa e fora do resultado (sinal pela coluna `tipo` do extrato, que é o sentido real do banco).
- O saldo inicial das contas vem de `bank_accounts` (em conta + aplicado), conferido contra o saldo do motor na tela de conferência.

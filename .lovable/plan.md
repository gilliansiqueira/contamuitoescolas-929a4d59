# Piloto: Fluxo de Caixa automático com conciliação (Dourados)

Nada será alterado antes da sua aprovação e da confirmação do cliente abaixo.

## 1. Como funciona hoje
- **Dashboard e Fluxo Diário** leem a mesma fonte oficial de movimentação mensal. Para cada mês, ela escolhe uma origem nesta ordem: mês fechado, extrato importado ("Fluxo de Caixa Realizado"), histórico digitado, projeção.
- O "Fluxo de Caixa Realizado" chega **já consolidado numa planilha**, sem separar por conta. Os lançamentos são gravados como realizados, e o saldo parte do saldo inicial da empresa.
- As datas futuras vêm dos lançamentos projetados: Sponte, cheques, cartões e Contas a Pagar.
- Hoje não existem conta bancária, conciliação nem histórico de conciliação.

## 2. Cliente-piloto
- **Dourados**. Identificador: `08d994fd-c1ca-448f-9e22-95810bb29ab4`. Saldo inicial cadastrado: R$ 163.084,91.
- **Confirme que é esse cliente antes da etapa 1.**

## 3. O que vem do "Fluxo de Caixa CM" (projeto lido, só como referência)
**Aproveitado (a lógica, reescrita neste projeto):**
- Leitores de extrato: OFX, CSV e Excel, com formatos específicos do Banco do Brasil e colunas de Crédito/Débito da Stone.
- A chave anti-duplicidade por cliente, calculada para cada lançamento.
- Cadastro de bancos e contas por cliente.
- Tela de fluxo: filtro por situação, seleção em lote, aprovação em massa, busca e contagem de pendências.
- Arquivo original guardado junto com o período do extrato.

**Não será trazido:**
- Categorização automática por IA e categorias próprias, porque a análise de despesas fica separada.
- O status "Aguardando" com motivos de justificativa. Pode entrar depois como observação, se você quiser.
- O banco, o login e a lista de clientes próprios dele.

**Diferença importante corrigida:** lá, o saldo atual soma apenas os lançamentos aprovados. Aqui, como você pediu, **todo lançamento realizado entra no saldo**, esteja conciliado ou não.

## 4. Onde fica: nova aba "Fluxo Bancário", só para administradores
- Uma aba principal nova, igual à aba Dados. Ela aparece só para **administradores** e só quando a empresa selecionada for o piloto.
- **O cliente não vê nada novo.** O Dashboard, o Fluxo Diário e os relatórios dele continuam exatamente como hoje, e os dados dele não mudam.
- Dentro da aba ficam três partes:
  - **Resumo**: saldo atual, entradas realizadas, saídas realizadas, saldo projetado, "atualizado até" por conta, % conciliado, pendências (quantidade e valor).
  - **Movimentações**: a tabela com todas as colunas pedidas. Situação em cores: Pendente amarelo, Conciliado verde, Não se aplica cinza. Conciliação individual e em lote, desfazer, filtros por conta, período e pendência, e histórico.
  - **Contas e Extratos**: cadastro das contas, envio dos arquivos, conferência antes de gravar e histórico de importações.
- Leitores: OFX, CSV/Excel (bancos e Stone) e PDF. O PDF passa por conferência obrigatória antes de gravar.
- **Nesta fase, os extratos ficam só nessa aba.** Dashboard e Fluxo Diário do cliente seguem com o upload atual. Quando os números da aba baterem com a planilha de vocês, ligamos numa segunda fase: os extratos passam a alimentar o Dashboard e o Fluxo Diário, pela mesma fonte oficial, sem cálculo próprio.

## 5. Tabelas novas (nenhuma tabela atual muda de estrutura)
- `bank_accounts`: empresa, nome, banco/Stone, agência/conta, saldo inicial e data, ativa.
- `bank_statement_imports`: empresa, conta, arquivo guardado, impressão digital do arquivo, período, quantidade, totais, quem importou e quando.
- `bank_transactions`: empresa, conta, importação, data, descrição original, valor, sentido, identificador do banco (quando houver), chave anti-duplicidade, par de transferência interna.
- `bank_reconciliations`: situação atual (Pendente / Conciliado / Não se aplica), quem, quando, observação.
- `bank_reconciliation_history`: registro de cada mudança, sem permissão para editar ou apagar.
- `school_features`: opção do piloto por empresa (ex.: `cashflow_bank_pilot`).
- Local privado para guardar os arquivos originais.
- `realized_entries`, `monthly_revenue`, as categorias e a importação de despesas **não mudam**.

## 6. Isolamento do piloto
- Duas travas: a opção precisa estar ligada **na Dourados** e o usuário precisa ser **administrador**.
- As regras de acesso do banco valem também para essa aba. Nesta fase, cliente não lê nem altera nada nas tabelas novas.

## 7. Como evitar duplicidade
- **Arquivo repetido**: bloqueado pela impressão digital do arquivo.
- **Lançamento repetido** (por exemplo, extratos com datas sobrepostas): chave única por conta. É o identificador do banco (OFX) ou, sem ele, data + valor + descrição normalizada + ordem da linha no dia.
- Antes de gravar, uma tela mostra os lançamentos novos, os já existentes e os divergentes.
- Excluir uma importação remove tudo o que veio dela, sem deixar lançamentos órfãos.
- **Planilha consolidada antiga**: no piloto, a partir de uma data de corte escolhida por você, os extratos por conta substituem o upload consolidado de Dourados. As duas fontes nunca somam juntas.

## 8. Separação da análise de despesas
- Os extratos ficam só nas tabelas novas.
- Nunca gravam em `realized_entries` e nunca passam pelas categorias gerenciais.
- O Relatório Realizado continua exatamente como está.

## 9. Etapas
1. Confirmar o cliente e ler o "Fluxo de Caixa CM".
2. Criar as tabelas novas, as regras de acesso e a opção do piloto, desligada.
3. Tela de contas e importação de OFX, com conferência, anti-duplicidade e arquivo guardado.
4. Importação de CSV/Excel (bancos e Stone) e depois de PDF.
5. Transferências entre contas próprias: pares identificados automaticamente, com confirmação manual. Contam só no saldo da conta, fora de entradas e saídas do consolidado.
6. Tabela de conciliação: individual, em lote, desfazer, "Não se aplica", filtros, totais pendentes e histórico.
7. Ligar os extratos na fonte oficial do Dashboard e do Fluxo Diário do piloto: realizado até hoje, projetado depois, saldo por conta e consolidado, "atualizado até" por conta.
8. Cartões do Dashboard do piloto.
9. Ligar a opção só para Dourados e validar.

## 10. Testes antes de liberar
- Reimportar o mesmo arquivo não cria nenhum lançamento a mais.
- Extratos com períodos sobrepostos não duplicam lançamentos.
- A conciliação não muda valor, data, saldo nem quantidade de lançamentos. Um teste compara o saldo antes e depois.
- Transferências entre contas não entram em entradas e saídas do consolidado.
- Saldo por conta igual ao saldo final do extrato do banco.
- Os números de outro cliente, comparados antes e depois, ficam idênticos.
- O cliente não consegue alterar a conciliação.
- O Relatório Realizado de Dourados fica idêntico.
- PDF do mês fecha com o Dashboard.

## 11. Como reverter
- Desligar a opção da Dourados faz tudo voltar na hora ao funcionamento atual, sem apagar nada.
- As tabelas novas ficam guardadas e não mexem em dados existentes.
- A planilha consolidada antiga continua disponível como fonte, se for preciso voltar.

## 12. O que preciso de você
- Confirmação: Dourados = `08d994fd-...`.
- Mover o "Fluxo de Caixa CM" para o mesmo espaço de trabalho.
- Um extrato real de cada conta e da Stone (OFX, CSV/Excel e PDF), de preferência de um mês já conferido.
- A lista das contas da Dourados, com o saldo de cada uma numa data de referência.
- A data de corte a partir da qual os extratos substituem a planilha consolidada.
- Os e-mails de quem pode conciliar, se não forem todos os administradores.

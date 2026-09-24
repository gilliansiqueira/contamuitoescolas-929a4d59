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

## 3. O que pode vir do "Fluxo de Caixa CM"
Ainda não consigo abrir esse projeto. Depois que você movê-lo para o mesmo espaço de trabalho, vou só ler:
- a tabela do fluxo com a marcação de conciliado;
- a seleção em lote e os filtros;
- a leitura dos extratos, se já existir.

Nada será conectado ao banco dele nem copiado de credenciais. Tudo será refeito no padrão visual, no login e nas permissões deste projeto.

## 4. O que será adaptado ou criado
- **Novo**: tela "Contas e Extratos" (cadastro de contas, envio de arquivo, histórico de importações).
- **Novo**: a tabela de conciliação dentro do Fluxo Diário, somente no piloto.
- **Novo**: os cartões do Dashboard do piloto (saldo atual, entradas e saídas realizadas, saldo projetado, última atualização, % conciliado, pendências em quantidade e valor).
- **Novo**: leitores de OFX (padrão dos bancos), CSV/Excel (bancos e Stone) e PDF. O PDF passa por uma conferência obrigatória antes de gravar.
- **Adaptado**: a fonte oficial de movimentação passa a aceitar os extratos por conta como mais uma origem de realizado, **somente quando a opção do piloto estiver ligada**. Nenhuma tela ganha cálculo próprio.

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
- Tudo depende de a opção estar ligada **na Dourados**. Sem ela, as telas e os cálculos seguem exatamente como hoje.
- Regras de acesso do banco por empresa, iguais às atuais. Só administradores alteram a conciliação; o cliente apenas vê.

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

# Aviso semanal para a Isa: pagamentos da obra da WNC

## O que a Isa vai ver
- Toda segunda-feira, a partir das 17h (horário de Brasília), aparece no sininho de avisos da Central um aviso para a Isa: "Mandar para a Bruna os pagamentos da obra da WNC (semana de dd/mm a dd/mm)".
- Também é criada uma tarefa na aba Tarefas, com a Isa como responsável e prazo no mesmo dia. A tarefa traz:
  - o total pago na semana anterior (segunda a domingo) nas categorias da obra (começando por "Estrutura Sala WNC");
  - a divisão: 50% WNC e 50% Conta Muito;
  - a lista dos pagamentos (data, descrição, valor);
  - um lembrete: "Antes de mandar, confira as pendências e conciliações da WNC — algum gasto da obra pode estar em outra categoria ou ainda sem categoria".
  - a quantidade de saídas da semana ainda "A classificar" ou pendentes, para ela revisar.
- Quando ela marca a tarefa como concluída, o aviso some. Você acompanha pela aba Tarefas.

## Como o valor é calculado
- Usa os pagamentos do banco da WNC já enviados ao Tiny com a categoria da obra. Se a equipe corrigir a categoria de algum pagamento, ele passa a contar.
- É só um lembrete com conferência: não muda receita, despesa, saldo nem nada no Tiny.

## Detalhes técnicos
- Tabela de configuração por empresa (categorias da obra, percentual de divisão, responsável, dia/hora), começando com WNC, "Estrutura Sala WNC", 50/50, Isa, segunda 17h.
- Agendamento semanal (1 execução por semana, segunda 20:00 UTC) que chama uma função do backend: soma `erp_push_log` (status enviado, tipo saída) pela categoria da obra no intervalo da semana anterior, conta pendentes/"a_classificar", e cria a linha em `mgmt_tasks` com a descrição montada; não cria em dobro se já existir para aquela semana.
- O aviso no sininho sai das tarefas abertas da Isa com prazo hoje (regra pura em `teamAlerts.ts`, com teste).
- Regra pura do cálculo de semana e divisão com teste (semana anterior seg–dom, 50/50 com arredondamento em centavos).

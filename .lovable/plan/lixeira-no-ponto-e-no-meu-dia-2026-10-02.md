# Lixeira no Ponto e no "Meu dia"

## 1. Ponto da Equipe — tirar funcionário
- Cada funcionário ganha um ícone de lixeira (só super admin). Ao clicar, o sistema pede confirmação: "Ocultar Fulano do Ponto? As horas ficam guardadas."
- O funcionário some das telas, dos totais e dos alertas do Ponto. As horas dele continuam guardadas.
- Uma nova sincronização ou importação de PDF **não** traz ele de volta.
- Um botão "Ver ocultos (N)" mostra a lista dos ocultos, com a opção "Restaurar".

## 2. Meu dia — tirar aviso de conta que não aconteceu
- Nos cards Pagamentos de hoje, Agendar hoje e Não saiu da conta, cada conta ganha uma lixeira ao lado de "Agendado".
- Ao clicar, o aviso some do painel, com o motivo opcional "Previsão não aconteceu". Fica registrado quem tirou e quando.
- **A previsão não é apagada**: continua no Fluxo Diário, no Dashboard e no saldo previsto. Para remover de verdade, a equipe continua usando a tela de projeção.
- "Desfazer" aparece por alguns segundos depois do clique.

## Efeito nos números
Nenhum. Os dois casos só escondem itens; os cálculos financeiros não mudam.

## Técnico
- Migração: `team_time_employees.oculto boolean default false` + `oculto_por`, `oculto_em`. O sync e o `import_report` não mexem nessas colunas (o upsert só envia os campos atuais).
- Edge Function `pontofopag-sync`: nova ação `set_employee_hidden` (super admin verificado, service_role grava) — mantém a regra de escrita só pela função.
- `useTeamTime.ts` e as telas do Ponto filtram `oculto=false` nas consultas de funcionários e de horas/ocorrências/banco de horas; a lista "Ver ocultos" faz a consulta inversa.
- Migração: `payable_acknowledgements.kind text default 'agendado'` (`agendado` | `descartado`) + `note text`. `useMyDay.ts` já esconde qualquer conta reconhecida; o `MyDayPanel` ganha o botão de lixeira que grava `kind='descartado'`.

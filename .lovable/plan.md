# Painel "Meu dia" para cada responsável

## Objetivo
No topo da Central, cada pessoa da equipe vê só as empresas pelas quais é responsável, com três blocos: contas a pagar, pendências e alertas de caixa. Super admin pode trocar a pessoa para ver o painel de qualquer uma delas.

## 1. Contas a pagar (a partir da previsão enviada)
- Fonte: lançamentos previstos de despesa da projeção (mesma fonte oficial do Fluxo Diário, sem recalcular).
- **Hoje**: "Pagamentos de hoje — Escola X: Simples Nacional R$ 3.200,00, Aluguel R$ 8.000,00".
- **Amanhã (1 dia útil antes)**: "Agendar para amanhã".
- **Fim de semana/feriado**: se o vencimento cai em sábado, domingo ou feriado nacional, o aviso aparece no último dia útil antes, marcado como "Vence domingo 20/10 — agendar hoje".
- Agrupado por empresa, com total do dia e atalho para o Fluxo Diário.
- Botão "Agendado" em cada conta (fica registrado quem marcou e quando, para o aviso sumir).
- **Conferência de pagamento pela conciliação**: no dia seguinte ao vencimento, o sistema procura no extrato conciliado uma saída de valor igual (com a tolerância de R$ 20 já usada hoje). Se encontrou, a conta some da lista sozinha. Se não encontrou: "Não saiu da conta — Escola X: Simples Nacional R$ 3.200,00 vencia ontem", para a equipe verificar se foi paga por outro meio ou remarcar.

## 2. Pendências das empresas dela
- **Conciliação atrasada**: lançamentos de dias anteriores sem conciliar (quantidade e valor).
- **Extrato não enviado**: empresas sem extrato do dia anterior.
- **Tarefas do dia**: tarefas ainda não marcadas (agendamento, baixas, fechamento de caixa).
- **Relatório do mês**: etapas abertas, com o prazo do 5º dia útil ("faltam 2 dias", em vermelho se atrasado).
- Cada item leva direto para a tela da empresa onde a tarefa é feita.

## 3. Alerta de caixa (próximos 15 dias)
- Usa o saldo previsto oficial (mesmo do Dashboard/Fluxo Diário).
- Se em algum dia dos próximos 15 o saldo ficar negativo: "Escola X — saldo previsto negativo em 14/10 (−R$ 12.400,00)". Mostra a primeira data e o menor saldo do período.
- Atalho para o Fluxo Diário daquela data.

## Visual
```text
Meu dia — Ana · sexta 02/10
[ Pagar hoje 5 | R$ 18.400 ] [ Agendar amanhã/antecipar 3 ] [ Pendências 7 ] [ Caixa em risco 1 ]
-> Lista expansível por empresa abaixo de cada card
```
Cores: vermelho para hoje/atrasado/caixa negativo, amarelo para amanhã/antecipar, verde quando está tudo em dia.

## Fora de escopo
- Avisos por e-mail/WhatsApp ou janela ao entrar no sistema (pode ser feito depois).
- Nenhuma mudança nos cálculos financeiros.
- Clientes não veem o painel.

## Detalhes técnicos
- Responsável vem de `school_management_settings` (o mesmo usado na carteira da Central).
- Contas a pagar e saldo previsto: no frontend via `useProjectedEntries` / `projectionEngine` + `classificationUtils` (só despesas pela SSOT, nunca pelo sinal), por empresa da carteira. Data de aviso = vencimento ajustado para o dia útil anterior (fim de semana + feriados nacionais, reaproveitando a lógica de `report_due_date`/`dateUtils`).
- Nova tabela `payable_acknowledgements` (school_id, entry_id, due_date, acknowledged_by/at) com GRANT + RLS só equipe, para o "Agendado".
- Pendências reaproveitam `get_management_daily_status`, `daily_task_checklist` e `monthly_closing_checklist`.
- Novo componente `MyDayPanel` no topo de `ManagementCenter.tsx`; seletor de pessoa só para super admin.
- Para não pesar, os cálculos por empresa são feitos sob demanda e guardados em cache por alguns minutos.

## Validação
- Conta com vencimento num domingo aparece na sexta como "antecipar".
- Valores do painel batem com o Fluxo Diário da empresa.
- Empresa com saldo negativo previsto em até 15 dias aparece no alerta de caixa.

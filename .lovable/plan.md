# Ativar o Fluxo Bancário no painel da Rondonópolis

## O que muda para você
- O painel e o Fluxo Diário da Rondonópolis passam a ler o banco a partir de **setembro/2026**, em vez da planilha.
- A Distribuição de lucros de Outubro (R$ 71.981,29) aparece em "Operações financeiras". Ela mexe só no caixa e não entra no Resultado.
- Setembro começa pelo saldo real do banco no dia 31/08/2026.
- Agosto e os meses anteriores não mudam.
- O aviso "Painel ainda usa a planilha" deixa de aparecer.
- Dá para voltar atrás a qualquer momento pelo botão "Pausar". Nenhum lançamento é apagado.

## Passos
1. Calcular o saldo do banco em 31/08/2026, somando as contas ativas e não virtuais. O cálculo é o mesmo que a tela de ativação usa.
2. Ativar a fonte: status "ativo", painel e Fluxo Diário lendo o Fluxo de Caixa, saldo de abertura igual ao valor do passo 1. A ação fica registrada no histórico como ativada a pedido da Bruna.
3. Conferir no painel de Out/2026:
   - aparece "Operações financeiras", com Distribuição de lucros de R$ 71.981,29;
   - o saldo inicial deixa de mostrar R$ 0,00 e bate com o saldo do banco.
4. Avisar que os 5 lançamentos da A.P LOPES ainda estão "A classificar". Eles ficam fora do Resultado até a equipe classificar.

## Detalhes técnicos
- Atualização em `school_data_sources` (school_id 4da792ce…): `status='ativo'`, `dashboard_source='fluxo_caixa'`, `daily_flow_source='fluxo_caixa'`, `opening_balance=<bankIni>`. É o mesmo patch que `useSetDataSourceStatus` aplica.
- Registro em `audit_log` com `action='fonte_fluxo_caixa'`.
- `bankIni` sai de `accountBalances(conta, txs, '2026-08-31').total`, somado entre as contas ativas, como em CashflowConference.
- Não muda nenhuma regra de cálculo nem nenhuma tela.

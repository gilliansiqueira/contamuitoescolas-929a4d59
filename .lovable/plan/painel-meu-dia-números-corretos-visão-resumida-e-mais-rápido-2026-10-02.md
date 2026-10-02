# Painel "Meu dia" — números corretos, visão resumida e mais rápido

## Por que os números estão estranhos
- **Caixa em risco (ex.: Fazenda Rio Grande −R$ 200 mil):** o painel parte do saldo inicial cadastrado na empresa e soma só as projeções. Ele não usa o saldo real do banco nem o que já foi realizado, como o Fluxo Diário faz. Por isso o resultado sai bem diferente da tela oficial.
- **"Não saiu da conta":** o painel só considera paga a conta que achou num lançamento do banco **já conciliado**. Conta paga mas ainda não conciliada aparece como "não saiu". Empresas sem extrato bancário no sistema mostram todas as contas vencidas como não pagas.

## O que vou mudar
1. **Caixa em risco igual ao Fluxo Diário:** partir do mesmo saldo de hoje que o Fluxo Diário mostra (realizado + saldo do banco conferido) e somar só as projeções dos próximos 15 dias. Antes de liberar, vou conferir Fazenda Rio Grande e mais 2 empresas: o saldo do painel tem que bater com o Fluxo Diário do mesmo dia.
2. **"Não saiu da conta" mais justo:**
   - procurar a saída em qualquer lançamento do extrato, conciliado ou não, com a tolerância de R$ 20;
   - só avisar quando já existe extrato da conta cobrindo o dia do vencimento + 3 dias (sem extrato, não há como saber; a conta fica fora do aviso);
   - empresas sem Fluxo Bancário ficam fora deste card.
3. **Visão resumida por empresa:** cada card mostra uma linha por empresa, por exemplo "Dourados — 10 contas a agendar · R$ 12.400". Ao clicar, abre a lista das contas daquela empresa, com o botão "Agendado" em cada uma. Vale para os cards Pagar hoje, Agendar, Não saiu da conta e Pendências. O card Caixa em risco já mostra uma linha por empresa.
4. **Velocidade:**
   - buscar só os lançamentos da janela necessária (10 dias atrás até 15 dias à frente) e usar o saldo de partida já pronto, em vez de baixar todo o histórico de cada empresa (hoje leva cerca de 20s);
   - carregar as empresas em paralelo e mostrar cada card assim que os dados chegam;
   - guardar o resultado por 10 minutos e não recarregar a cada troca de aba;
   - verificar se as consultas mais lentas do banco precisam de índice e criar os que faltarem.
   Meta: o painel abrir em poucos segundos.

## Como vou conferir
Vou abrir o painel com o login da Rubia. Vou comparar Fazenda Rio Grande com o Fluxo Diário e sortear 3 contas de "Não saiu da conta" para checar no extrato. Também vou medir o tempo de carregamento antes e depois.

## Detalhes técnicos
- `useMyDay.ts`: o saldo de partida passa a vir da mesma origem do `DailyFlowTable` (`usePeriodMovementCtx` / `useConfirmedBankBalance` / `useCashflowAnchor`, conforme `dashboard_source`). Saldo = saldo oficial de hoje + `impacto` das projeções (`projectEntries`) de amanhã até hoje+15. Nada é recalculado fora da SSOT.
- `paidOuts`: sai o filtro `recon_status='conciliado'`, passa a ser `is_forecast=false`, e o vencimento só é avaliado se houver `bank_statement_imports.periodo_fim >= vencimento+3` em alguma conta ativa.
- `financial_entries` filtrado por `data` entre hoje−40 e hoje+20 (a margem cobre os prazos de recebimento), em vez de pegar tudo desde `saldo_inicial_data`.
- `MyDayPanel.tsx`: agrupa por `schoolId` dentro de cada card (linha "Empresa — N itens · total" que expande para a lista).
- `supabase--slow_queries` + EXPLAIN; índices em `financial_entries(school_id, data)` e `bank_transactions(school_id, tipo, data)`, se ainda não existirem.

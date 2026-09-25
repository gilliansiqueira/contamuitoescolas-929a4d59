# Uberlândia Centro: diferença de -R$ 932,71 na Conferência

## O que está acontecendo
A transferência Asaas Centro → Sicredi Centro está certa e pareada. O problema é o período da conferência:
- A saída do Asaas foi em **24/09** e a entrada no Sicredi em **25/09**.
- O campo "Até" da Conferência começa fixo em **24/09/2026** (valor gravado na tela), mesmo com o sistema atualizado até 25/09.
- Assim o saldo bancário de 24/09 já não tem os R$ 932,71 no Asaas, mas ainda não tem no Sicredi: o dinheiro está "em trânsito" e aparece como diferença.

Nenhum lançamento está errado e nada será alterado nos dados.

## O que vou mudar
1. **"Até" automático**: o campo passa a abrir com a data "atualizado até" (hoje 25/09), em vez do 24/09 fixo. Com isso Uberlândia Centro deve fechar.
2. **Transferência em trânsito**: se a pessoa escolher uma data em que uma ponta da transferência já saiu e a outra ainda não entrou, a diferença é explicada numa linha própria "Transferências em trânsito" (com as linhas listadas) e não conta como divergência no fechamento.
3. Conferir na tela de Uberlândia Centro que o fechamento mostra "Fecha".

## Detalhes técnicos
- `CashflowConference.tsx`: `to` inicializa com `cfg.synced_through` (fallback hoje) e acompanha quando ele carregar.
- No cálculo do fechamento: somar pares com `transfer_pair_id` em que uma ponta está em `[from, to]` e a outra depois de `to`; mostrar como ajuste explicado (saída sem entrada = valor em trânsito), exibindo as transações.
- Sem migration e sem mudança em lançamentos, SSOT ou Dashboard.

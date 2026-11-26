# Ignorar pendências de agosto (contam só no saldo)

## O que encontrei
Hoje existem pendências de conciliação com data em agosto/2026 em 26 empresas (ex.: Farmácia Magistral 223, Dourados 211, São Braz 103, Salto 65, São Carlos 63, Cuiabá Jardim Itália 57, BH Cidade Jardim 49, Portão 46, Ather 36 e outras menores). Conciliadas de agosto não são afetadas.

## O que vai mudar
- Nada é apagado: os lançamentos de agosto continuam gravados e seguem somando nos saldos e totais (Caixa, Resultado, conferência de saldo).
- Pendências com data antes de 01/09/2026 deixam de aparecer como "pendente" para a equipe: saem dos contadores da Central, da bolinha de atraso, das pendências anteriores e do bloqueio de fechamento do dia.
- Para o cliente, as pendências só aparecem a partir de setembro em todas as empresas (hoje isso já vale onde o acompanhamento começa em setembro; passa a ser regra geral, mesmo com início mais antigo).
- No Fluxo Bancário, as linhas de agosto continuam aparecendo como pendentes, para consulta da equipe.

## Detalhes técnicos
- Data de corte única 2026-09-01 aplicada nas RPCs da Central (portfolio, daily status, reconciliation backlog), em `close_recon_day`, nas RPCs `client_pending_*`; o Fluxo Bancário não muda.
- Sem alterar `recon_status` nem valores: só filtros de contagem/exibição (SSOT intocada).
- Regra registrada no AGENTS.md; teste do corte (31/08 ignorada, 01/09 conta).

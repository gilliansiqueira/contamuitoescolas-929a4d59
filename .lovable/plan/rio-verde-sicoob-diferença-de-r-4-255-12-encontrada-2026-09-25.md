# Rio Verde (Sicoob): diferença de R$ 4.255,12 encontrada

## A causa (confirmada pelo PDF)
Comparei o saldo de cada dia do PDF com o sistema. A diferença é causada por **4 depósitos de cheque**, que ficam bloqueados por 1 dia e são contados duas vezes:

| Dia do depósito (bloqueado) | Valor | Dia em que o banco liberou |
|---|---|---|
| 10/09 DEP.CHEQUE BLOQ.1D | R$ 1.641,25 | 11/09 (R$ 1.055,00 + R$ 586,25) |
| 15/09 DEP.CHEQUE BLOQ.1D | R$ 1.055,66 | 16/09 |
| 18/09 DEP CH.CANAL ATEND.1D | R$ 470,25 | 21/09 |
| 22/09 DEP CH.CANAL ATEND.1D | R$ 1.087,96 | 23/09 |
| **Total** | **R$ 4.255,12** | |

No PDF, o depósito bloqueado aparece com asterisco (*) e **não entra no saldo**. O dinheiro só entra na linha "LIBERAÇÃO DE DEPÓSITO BLOQUEADO". O OFX manda as duas linhas como entrada, e o sistema contou as duas. Sem esses 4 lançamentos, a conta fecha em **R$ 6.636,97** em 25/09, igual ao banco. Também em 11/09, o cheque devolvido (R$ 1.055,00) é compensado pela liberação do mesmo valor, como no PDF.

Procurei em todas as empresas: só Rio Verde tem esse caso hoje.

## O que vou fazer
1. **Nas próximas importações (OFX e PDF do Sicoob):** o sistema reconhece o depósito bloqueado ("DEP.CHEQUE BLOQ", "DEP CH.CANAL ATEND" ou valor com *) e não conta essa linha, porque o valor entra depois na liberação. O aviso da importação mostra quantas linhas foram deixadas de fora e o valor.
2. **Rio Verde, dados atuais:** tirar do saldo esses 4 lançamentos duplicados. Não dá para usar "Ignorar", porque "Ignorar" continua mexendo no saldo bancário. Vou retirar só essas 4 linhas e registrar a retirada no histórico de alterações, com o motivo. Nenhuma outra linha muda.
3. **Conferir na tela** que o Sicoob de Rio Verde fica "confere" em 25/09, com R$ 6.636,97 em conta e R$ 76.451,72 aplicado (diferença esperada de uns R$ 0,37 de rendimento).

## Detalhes técnicos
- `parsers.ts`: no OFX e no PDF, pular lançamentos de crédito com memo `/DEP\.?\s?CH(EQUE)?\.?\s?BLOQ|DEP CH\.CANAL ATEND/i` (e, no PDF, valor com sufixo `*`). Contar os pulados em `warnings`. Teste novo com as 4 linhas.
- Dados: gravar em `bank_reconciliation_history` (ação "removido: depósito bloqueado duplicado") e depois apagar as 4 linhas de `bank_transactions` pelo id (conta 1fc393d8), via run_sql. Depois, rodar `sync_bank_cashflow_school` de Rio Verde.

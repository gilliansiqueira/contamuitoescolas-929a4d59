# Palmital – Stone: diferença de R$ 4.630,18

## O que o extrato completo mostrou
O extrato da Stone (conta 4867952-6, 01/11 a 25/11) fecha em R$ 12,00 e tem 24 lançamentos. Todos eles já estão na plataforma.

Mas a plataforma tem **6 recebimentos a mais**, que não existem nesse extrato. Eles vieram do arquivo "Comprovante de Extrato (10).ofx", enviado em 04/11, e já estão conciliados:

| Data | Descrição | Valor |
|---|---|---|
| 03/11 | Recebimento vendas – Visa | 1.178,59 |
| 03/11 | Recebimento vendas – Mastercard | 1.250,47 |
| 03/11 | Recebimento vendas – American Express | 104,77 |
| 03/11 | Recebimento vendas – Elo | 416,43 |
| 04/11 | Recebimento vendas – Mastercard | 394,05 |
| 04/11 | Recebimento vendas – Visa | 1.285,87 |
| | **Total** | **4.630,18** |

A soma é exatamente a diferença da Stone. Por isso a saída de R$ 4.630,18 não aparecia: o que existe a mais são essas entradas. Provavelmente o arquivo de 04/11 era de outra conta Stone, ou o banco desfez esses recebimentos depois.

## O que vou fazer (após aprovação)
1. Desfazer a conciliação desses 6 lançamentos e apagá-los, só na Stone de Palmital. Nenhum outro lançamento muda.
2. Conferir nos dados que o saldo da Stone fica em R$ 12,00 em 25/11, igual ao banco.
3. Recalcular a diferença entre o Dashboard e o Resumo do Saldo Total. Bradesco e BB devem se acertar quando a equipe subir os extratos dos dias já fechados.

## Ponto de atenção
Como esses recebimentos estavam conciliados, alguém da equipe os ligou a uma previsão de cartão. Depois da exclusão, essas previsões voltam a aparecer como não recebidas, e a equipe deve confirmar se o cartão caiu em outra conta.

## Detalhes técnicos
- Conta: bank_accounts df6efab7-8aae-4676-b73d-05075c21ff2a.
- Os 6 bank_transactions do import "Comprovante de Extrato (10).ofx" (bank_ref 01a1a11e-1052…, 01a1a634-4bff…, 01a1a125-35f1…, 01a1a640-5ef7…, 01a1a10b-a4df…, 01a1a10f-06c3…) são removidos via delete_bank_tx ou SQL, com registro na auditoria.

# São Carlos: Inter Matriz, cheques em compensação

## O que é (confirmado)
O caso é parecido com o de Rio Verde, mas não igual. Aqui não tem nada duplicado.
- No PDF do Inter: **saldo total R$ 28.200,85** = disponível R$ 13.654,45 + **bloqueado R$ 14.546,40**.
- Os R$ 14.546,40 bloqueados são exatamente os **26 cheques recebidos em 25/09**, que ainda estão compensando.
- Somando os lançamentos, o sistema chega a **R$ 28.200,85**, igual ao saldo total do banco e ao fluxo de vocês. Os lançamentos estão certos.
- A diferença aparece só na conferência: o arquivo OFX do Inter informa apenas o **saldo disponível** (R$ 13.654,45). A tela compara com ele, mostra esse valor em "Em conta" e aponta −R$ 14.546,40.

Diferença do Sicoob: no Sicoob o cheque aparecia duas vezes (depósito e liberação). No Inter aparece uma vez só, e o banco apenas separa como "bloqueado" até compensar. Por isso não se tira nenhum lançamento aqui.

## O que vou fazer
1. **Corrigir São Carlos agora:** no extrato OFX já importado, trocar o saldo informado para o saldo total, R$ 28.200,85. Nenhum lançamento muda. A conta passa a "confere" com R$ 28.200,85.
2. **Nas próximas importações do Inter:**
   - PDF do Inter: ler o "Saldo total (bloqueado + disponível)".
   - OFX do Inter: se a diferença for exatamente a soma dos cheques recebidos nos últimos dias úteis, tratar como **"Cheques em compensação"**. Isso não conta como diferença e aparece como um aviso informativo na conta, por exemplo: "R$ 14.546,40 em cheques compensando".
3. Conferir na tela de São Carlos.

## Detalhes técnicos
- run_sql: `bank_statement_imports.saldo_final_informado = 28200.85` para o import "Extrato- inter.ofx" da conta 0f26b5d2 (auditado).
- parsers.ts: Inter PDF → capturar "Saldo total" como saldoFinalInformado.
- Conferência de saldo (useBankPilot/engine): se |diferença| = soma de "Cheque recebido" da conta nos últimos 2 dias úteis até a data do extrato, marcar como "em compensação" e não como divergência; teste unitário.

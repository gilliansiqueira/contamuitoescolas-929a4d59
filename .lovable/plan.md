# Limpar duplicados do Bradesco + conferir Portão

## O que vai ser feito
1. Remover as 6 cópias pendentes (R$ 3.472,35), mantendo a original.
2. Remover as 25 cópias já conciliadas (R$ 35.789,49), sempre mantendo uma versão conciliada de cada lançamento.
3. Gravar o Pix do Raimundo Marques (R$ 315,00, 05/10) em Manaus Laranjeiras, ligado ao extrato de 07/10.
4. Cada remoção fica no histórico com o motivo "duplicado – banco renumerou o código".
5. Conferir de novo, depois da limpeza, que nenhuma empresa ficou com duplicados e que os saldos conferidos continuam batendo.

## Portão
Portão não estava na lista. Hoje existe lá só um par igual: "DEBITO CONVENIOS PMCURIT" de R$ 911,27 em 18/09, os dois conciliados. Como tem o mesmo código da prefeitura, pode ser um débito realmente cobrado duas vezes — vou comparar com o extrato antes de mexer: só removo se o extrato mostrar uma única cobrança. As cópias que você já apagou em Portão hoje não aparecem mais.

A correção da importação (já feita) evita que Portão e as outras empresas dupliquem de novo.

## Detalhes técnicos
- Remoção via RPC `delete_bank_tx(_tx_id, _motivo)`; mantém a linha mais antiga (ou a conciliada quando só uma estiver).
- Pix Raimundo inserido com `origem` do import de 07/10 (rastreabilidade) e `recon_status` pendente.
- Portão: comparar `bank_ref`/arquivo das duas linhas de 18/09 com o OFX/saldo da conta.

# São Mateus — liberar "Aprovar e ativar"

## O que trava hoje
1. **1 lançamento "A classificar"**: Pix de 05/09 na Stone, R$ 1.664,97 ("RAMIN ... Transferência | Pix"). Ele está marcado como transferência entre contas da empresa, mas não existe a entrada correspondente em nenhuma conta de São Mateus — o dinheiro foi para a conta pessoal dela no Inter. Sem o par, o sistema não sabe como tratar e trava o botão.
   - Os outros dois Pix Stone → Sicredi (14/09 e 16/09) têm par e estão certos.
2. **Aviso "Subir o extrato de Stone, Sicredi até 30/09"**: aviso falso. As duas contas já têm extrato até 01/10. Ele não trava o botão, mas confunde.

## O que vou fazer
1. **Pix de 05/09**: tirar a marcação de transferência entre contas e classificar como **Distribuição de lucros** (item do modelo de São Mateus), com nota "Pix para conta pessoal no Inter". Fica registrado no Histórico de Alterações. Se preferir Pró-Labore ou Operação (só Caixa), é só dizer antes de aprovar.
2. **Melhorar a tela para os próximos casos**: transferência sem par na mesma empresa passa a aparecer na lista de pendências como "Transferência sem conta de destino da empresa — escolha um item (ex.: retirada de sócio)", com atalho para classificar.
3. **Corrigir o aviso de extrato**: só aparece quando o extrato de alguma conta termina antes do último dia do mês.
4. Abrir a prévia de São Mateus e conferir que o botão fica liberado e os saldos continuam batendo (R$ 466,92 em 30/09).

## Efeito nos números
- Saldo dos bancos: não muda (o dinheiro já saiu da Stone).
- Despesas e Resultado de setembro: passam a incluir R$ 1.664,97 se for Distribuição de lucros/Pró-Labore; se for Operação, só o Caixa.

## Técnico
- Atualizar `bank_transactions` 29ed890c-…: `movement_kind` = despesa + `model_item_id` do item escolhido (via fluxo normal, gatilhos de sincronização recalculam o Fluxo).
- `ActivationPreview.tsx`: `holder` só gera aviso/todo se `bankTo < monthEnd`; motivo explícito para transferência sem `transfer_pair_id`.

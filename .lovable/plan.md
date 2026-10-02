# São Mateus — liberar "Aprovar e ativar"

## O que trava hoje
1. **1 lançamento "A classificar"**: Pix de 05/09 na Stone, R$ 1.664,97 ("RAMIN ... Transferência | Pix"). Ele está marcado como transferência entre contas da empresa, mas não existe a entrada correspondente em nenhuma conta de São Mateus — o dinheiro foi para a conta pessoal dela no Inter. Sem o par, o sistema não sabe como tratar e trava o botão.
   - Os outros dois Pix Stone → Sicredi (14/09 e 16/09) têm par e estão certos.
2. **Aviso "Subir o extrato de Stone, Sicredi até 30/09"**: aviso falso. As duas contas já têm extrato até 01/10. Ele não trava o botão, mas confunde.

## O que vou fazer
1. **Pix de 05/09**: não mexo. As meninas vão classificar.
2. **Deixar a pendência clara na prévia**: transferência sem par na mesma empresa aparece separada na lista do que falta, com data, conta, valor e descrição: "Transferência sem conta de destino da empresa (ex.: conta pessoal do sócio) — escolha um item, como Distribuição de lucros ou Pró-Labore". Cada linha tem um atalho que abre esse lançamento em Movimentações.
3. **Mostrar quais são os "A classificar"**: em vez de só "Classificar 1 movimentação", a prévia lista os lançamentos (data, conta, valor, descrição) com atalho.
4. **Corrigir o aviso de extrato**: só aparece quando o extrato de alguma conta termina antes do último dia do mês. Em São Mateus ele some.
5. Abrir a prévia de São Mateus e conferir que a pendência aparece com o Pix de 05/09 e que o aviso falso sumiu.

## Efeito nos números
Nenhum. Só muda o que aparece na tela.

## Técnico
- `ActivationPreview.tsx`: `holder` gera aviso/todo só se `bankTo < monthEnd`; separar `aClass` entre transferência sem `transfer_pair_id` e demais; listar itens com link para Movimentações filtrado pelo lançamento.

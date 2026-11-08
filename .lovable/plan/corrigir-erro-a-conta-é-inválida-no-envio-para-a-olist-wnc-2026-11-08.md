# Corrigir erro "A conta é inválida" no envio para a Olist (WNC)

## O que aconteceu
Os 41 lançamentos foram recusados pela Olist pelo mesmo motivo: `conta.id — A conta é inválida`. A autorização e as categorias estão funcionando. O problema está só no número da conta "Banco Inter" (904945983) que mandamos no lançamento de Caixa. A Olist não aceita esse número nesse lançamento. Na Olist nada foi gravado, e nos números da plataforma também nada mudou.

Causa provável, ainda não confirmada: a lista "Banco Inter" vem da tela de contas bancárias da Olist, mas o lançamento de Caixa pode esperar outro identificador, ou outro formato de campo (tipo E/S em vez de C/D, data em outro formato).

## Passos
1. **Confirmar o formato que a Olist espera:** com o token real da WNC, ler um lançamento de Caixa que já existe na Olist e as contas que ela aceita nele, para comparar os campos (conta, tipo e data) com o que estamos enviando.
2. **Ajustar o envio** em `olist-sync`: usar o identificador e os campos certos. Se a conta vier de outra lista, trocar a lista que aparece em "Conta bancária na Olist" para mostrar só contas que funcionam.
3. **Mensagem de erro mais clara no painel:** mostrar o motivo resumido (ex.: "Conta da Olist inválida — escolha de novo em Contas e categorias") em vez do texto técnico cortado.
4. **Testar com 1 lançamento real** de valor baixo e conferir se ele aparece no Caixa da Olist. Só depois usar "Reenviar com erro" para os outros 40.

## O que você faz agora
Nada por enquanto. Não clique em "Enviar agora" de novo até a correção, porque os lançamentos vão continuar dando o mesmo erro. Nada vai duplicar: cada lançamento continua sendo enviado uma vez só.

## Detalhes técnicos
- Registro: `erp_push_log.erro` = `400 POST /caixa {"campo":"conta.id","mensagem":"A conta é inválida."}`; `erp_account_links.olist_conta_id = 904945983`, vindo de `GET /contas-bancarias`.
- Hoje o envio manda `tipo: 'D'|'C'`, `data` em ISO e `conta: { id }`. Validar na resposta do `GET /caixa`.

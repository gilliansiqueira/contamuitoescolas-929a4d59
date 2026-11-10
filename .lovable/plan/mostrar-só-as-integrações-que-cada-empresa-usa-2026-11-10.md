# Mostrar só as integrações que cada empresa usa

## Problema
O quadro do Mercado Pago aparece para a administração em **todas** as empresas, mesmo sem uso (como na Quintal de Casa). O mesmo vai acontecer com o Asaas nas escolas.

## O que muda
- Em Contas bancárias, os quadros **Mercado Pago** e **Asaas** só aparecem na empresa que tiver aquela integração ligada.
- Um botão discreto **"Adicionar integração"** (só administração) lista Mercado Pago e Asaas; escolher uma faz o quadro aparecer naquela empresa. Dá para remover se a empresa não tiver chave cadastrada.
- **Quintal de Casa:** fica só Asaas (além de Inter e Tiny). Mercado Pago some.
- **WNC:** continua com Mercado Pago (já estava em piloto).
- Inter e Tiny não mudam.

Nenhum dado, chave ou cálculo é alterado: só o que aparece na tela.

## Detalhes técnicos
- Usar `school_features` com as chaves `mercadopago_conector` (já existente) e `asaas_conector` (nova); o painel mostra o quadro quando a feature está ligada ou já existe `acquirer_connections` daquele provider.
- Gravar a escolha pela mesma rota já usada (`school_features`, só super_admin); ligar `asaas_conector` para a Quintal e conferir que a Quintal não tem conexão Mercado Pago.
- Mudança restrita a `BankAccountsImports.tsx`, `MercadoPagoPanel.tsx` e `AsaasPanel.tsx`.

# Acertar o BB de Palmital com os extratos enviados

## O que os extratos mostram
- Os dois arquivos são do BB de Palmital (28/09 a 27/11) e terminam em R$ 460,33, igual ao saldo informado pelo banco.
- Em 30/09, o extrato tem o Pix de R$ 2.533,78 para a Conexão Fluente e, no mesmo dia, um resgate automático "BB RENDE FÁCIL" de R$ 2.533,78. A plataforma tem o Pix, mas não tem o resgate. É isso que deixa o BB R$ 2.533,78 abaixo do banco.

## Passos
1. Gravar só o resgate automático de 30/09 (entrada de R$ 2.533,78, "BB RENDE FÁCIL"), ligado ao arquivo enviado para manter a origem rastreável. Nenhuma outra linha muda.
2. Descobrir por que a importação descartou essa linha, provavelmente por confundi-la com o Pix de mesmo dia e valor. Se for uma regra da importação, corrigir para que entrada e saída nunca sejam tratadas como duplicadas e incluir um teste.
3. Conferir que a conta corrente do BB fecha em R$ 460,33 em 27/11 e que o Fluxo Diário e o Fluxo Bancário de Palmital ficam iguais, a não ser pelo Bradesco.

## Fica pendente
- Bradesco de Palmital (diferença de R$ 1.561,74): os arquivos enviados são do BB. Ainda falta o extrato do Bradesco de 01/09 até hoje.

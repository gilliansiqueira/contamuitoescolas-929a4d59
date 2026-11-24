# Bairro Alto: remover a entrada de R$ 894,82 que não existe no banco

## O que aconteceu (conferido)
- O extrato do Itaú enviado em **23/11 às 14h** foi baixado com o dia ainda aberto. Nele, o banco mostrava uma parcial de "BOLETOS RECEBIDOS" de **R$ 894,82**.
- No extrato de **24/11** (o arquivo que você mandou), o Itaú já fechou o dia 23/11 e juntou tudo em um único "BOLETOS RECEBIDOS" de **R$ 2.434,48**. A linha de R$ 894,82 não aparece mais.
- Os dois têm códigos diferentes no banco, por isso o sistema achou que eram lançamentos diferentes e gravou os dois. O de R$ 2.434,48 já foi conciliado pela Rayssa. O de R$ 894,82 está pendente e com justificativa.

## Correção
1. Apagar somente o lançamento de R$ 894,82 de 23/11 (pendente) na conta Itaú do Bairro Alto. Junto, sai a justificativa ligada a ele. O de R$ 2.434,48 conciliado não muda.
2. Conferir depois que o saldo do dia 23/11 em diante bate com o saldo do extrato do banco (R$ 5.936,91 em 24/11).
3. Procurar o mesmo caso em outras contas do Itaú: lançamentos pendentes de "BOLETOS RECEBIDOS" que vieram de um extrato do dia aberto e sumiram do extrato seguinte. Vou te mandar a lista para decidir, sem apagar nada sozinho.

## Detalhe técnico
Excluir `bank_transactions` id `ef02d3ff-911f-40bb-b300-85105b862abc` (bank_ref 20261123004, import `3ad625b3…`), usando a mesma rotina de exclusão que a tela usa, para refletir no espelho do fluxo. Não altera regras de importação.

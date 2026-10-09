# Asaas Fazenda Rio Grande — diferença de R$ 300,55 em setembro

## O que o extrato mostrou
- Extrato de setembro: 542 lançamentos, saldo final em 30/09 de R$ 5.142,57 (bate com saldo inicial R$ 1.064,95 + movimento R$ 4.077,62).
- No sistema há 540 lançamentos. Faltam exatamente 2, que somam R$ 300,55:
  - 08/09 — Pix para A C FERREIRA - ESCOLA DE IDIOMAS: R$ 300,00 (o banco tem **dois** Pix iguais nesse dia, com códigos diferentes; o sistema guardou só um).
  - 25/09 — Taxa de notificação por WhatsApp: R$ 0,55 (mesma situação: duas taxas iguais no dia, só uma ficou).

## Causa
A proteção contra duplicidade (criada para o Bradesco que renumera códigos) passou a juntar também lançamentos legítimos repetidos — mesmo dia, mesmo valor e mesmo texto — vindos do mesmo arquivo.

## Correção
1. Ajustar a proteção: dentro de um mesmo arquivo, lançamentos com códigos diferentes nunca são juntados; entre arquivos, só reaproveita quantas cópias já existirem gravadas (se o sistema tem 1 e o extrato tem 2, grava a segunda).
2. Teste automático com este caso (dois Pix de R$ 300 no mesmo dia) e com o caso Bradesco renumerado, para garantir que nenhum dos dois volta a falhar.
3. Reimportar este extrato de setembro em Fazenda: entram só as 2 linhas faltantes, como pendentes de conciliação. Setembro fecha em R$ 5.142,57 e o saldo do Asaas deixa de ter a diferença histórica.
4. Varredura nas demais empresas procurando o mesmo tipo de falta (extratos com repetições reais que ficaram com uma só), apenas listando para conferência — nada é alterado sem aviso.

## Detalhes técnicos
- Regra em `sameBankEntryText`/reaproveitamento de linhas: casar por multiplicidade (contagem por dia/sentido/valor/texto) e tratar FITIDs distintos no mesmo arquivo como lançamentos distintos.
- Brasília permanece fora de qualquer alteração.

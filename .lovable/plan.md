# Manaus Laranjeiras – receita de novembro inflada no Fluxo Diário

## O que encontrei
Os R$ 464 mil do Fluxo Diário em novembro são cartão (R$ 454.296,88) + Sponte (R$ 10.006,89). O cartão está **duplicado** entre 03/11 e 17/11:

- Arquivo de cartão enviado em **06/11**: 340 linhas, R$ 156.701,74 (03/11 a 17/11).
- Arquivo de cartão enviado **hoje (25/11)**: 1.473 linhas, de 03/11 a 24/05/2027 — R$ 202.016,61 no mesmo período de 03/11 a 17/11.

O arquivo novo não substituiu o antigo no período em que os dois se sobrepõem, então os dois somam juntos.

## O que vou fazer
1. Apagar o envio de cartão de 06/11 com todos os seus lançamentos (exclusão em cascata, sem deixar nada solto). O arquivo de hoje fica como está.
2. Conferir de novo os totais de novembro: cartão deve cair para cerca de R$ 297.595,14 e a receita do mês para cerca de R$ 307,6 mil no Fluxo Diário.
3. Comparar com os R$ 219.204,97 da simulação e explicar linha por linha qualquer diferença que sobrar (a simulação pode estar descontando o que já entrou no banco até hoje).
4. Verificar por que o envio de hoje não substituiu o antigo a partir da data escolhida e corrigir a importação de cartão, para que um arquivo novo sempre troque o anterior a partir da data de início, sem duplicar.

Nenhum outro lançamento, regra de cálculo ou escola será alterado.

# FourBio: por que as pendências aumentaram depois do feriado

## O que aconteceu
Em 23/11 a equipe enviou o extrato da Stone "Comprovante de Extrato (56).ofx". Esse arquivo trouxe **538 lançamentos**, de 24/08 a 23/11, e todos ficaram pendentes.

| Período do arquivo | Lançamentos | Valor |
|---|---|---|
| Agosto (24 a 31/08) | 102 | R$ 91.254,18 |
| Setembro | 395 | R$ 418.756,51 |
| Novembro (19, 21 e 23/11) | 41 | R$ 113.973,38 |

- A Stone da FourBio na plataforma começa em **01/10**. Até ontem não havia nenhum lançamento da Stone antes disso.
- Por isso, **497 das pendências novas (agosto e setembro)** são de um período anterior ao início do acompanhamento. Elas não estavam no sistema e não são lançamentos repetidos.
- Os 41 de novembro são movimento normal dos dias do feriado e de ontem. Somados aos do Sicoob (5) e aos que já estavam abertos, eles explicam o restante.

Provável causa: ao baixar o extrato na Stone, o período escolhido começou em agosto, e não a partir do último envio.

## Proposta
1. Apagar só os 497 lançamentos de agosto e setembro desse arquivo da Stone. Nenhum foi conciliado nem enviado a outro sistema.
2. Manter os 41 de novembro, que são movimento real.
3. Conferir que o saldo da Stone em 30/09 e 01/10 continua igual ao de antes do envio e que não sobrou nada no espelho do Fluxo Bancário.
4. Avisar a equipe: nos próximos envios da Stone, baixar só a partir do último dia enviado. Mesmo que venha período a mais, nada se duplica, mas os meses antigos viram pendência.

## Detalhes técnicos
- Apagar de `bank_transactions` filtrando por school_id da FourBio, import_id do "Comprovante de Extrato (56).ofx" e data < '2026-10-01'. Os gatilhos limpam `bank_cashflow_entries`.
- Nenhuma mudança de código ou de cálculo.

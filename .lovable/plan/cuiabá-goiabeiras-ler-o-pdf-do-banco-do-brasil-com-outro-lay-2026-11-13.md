# Cuiabá Goiabeiras: ler o PDF do Banco do Brasil com outro layout

## O que aconteceu
A trava de conta já foi tirada. O erro de agora é outro: a plataforma não conseguiu **ler** o PDF. Este extrato do BB vem num layout diferente dos outros:
- a data fica sozinha numa linha e o valor fica na linha de baixo;
- o "Saldo do dia" vem com a data 00/00/0000;
- o saldo final aparece como "SALDO" (em vez de "Saldo do dia").

Por isso a leitura não achou o saldo anterior nem o final e, por segurança, não importou nada. Conferi o PDF à mão e ele fecha certinho: começa em R$ 0,00 e todo dia zera por causa do BB Rende Fácil. Ele termina com -R$ 10.405,82 em conta, mais R$ 16.970,72 aplicados, o que dá R$ 6.564,90 no total, igual ao impresso.

## O que vou fazer
1. Ensinar a leitura do PDF do BB a reconhecer esse layout:
   - juntar a data da linha de cima com o valor da linha de baixo;
   - usar a última data válida quando aparecer 00/00/0000;
   - aceitar "SALDO" como saldo final.
2. Manter a conferência de segurança: se algum "Saldo do dia" não fechar com os lançamentos, nada é importado (regra de sempre).
3. Testar com este PDF de Goiabeiras e confirmar:
   - lançamentos de 03/11 a 12/11;
   - os saldos de cada dia fechando;
   - saldo total de R$ 6.564,90.
4. Rodar os testes dos outros PDFs do BB para garantir que nada piorou.

## Detalhes técnicos
- `src/lib/bankStatements/parsers.ts`, `parseBBContaCorrentePdfLines`: pré-normalização das linhas (data isolada + linha seguinte com valor "(+)/(-)" sem data → linha única; texto após a data isolada vira histórico; `00/00/0000` → última data); `/^saldo$/` tratado como saldo do dia final.
- Novo teste em `src/test/bankBbContaCorrentePdf.test.ts` com as linhas reais extraídas deste PDF, além dos testes BB existentes.

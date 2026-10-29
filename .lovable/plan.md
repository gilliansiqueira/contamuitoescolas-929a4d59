# Corrigir leitura do saldo negativo no PDF do Sicoob (Go Company)

## O que está errado
Os 5 lançamentos do extrato foram lidos certos (entradas R$ 1.000,00, saídas R$ 6.009,00). O erro está no **saldo**: no PDF a conta fechou **negativa** — "2.412,00 D" (D = devedor). O sistema leu como positivo (+2.412,00).
- Por isso a diferença de −4.824,00 (o dobro de 2.412).
- E o total com aplicação saiu R$ 28.397,26, quando o certo é 25.985,26 − 2.412,00 = **R$ 23.573,26** (igual ao "Saldo disponível" do extrato).

Conta: 2.597,00 + 1.000,00 − 6.009,00 = −2.412,00. Fecha.

## O que vou fazer
1. No leitor do Sicoob, considerar a letra C/D do saldo, mesmo quando ela aparece na linha de baixo do valor (como em "SALDO DO DIA", "SALDO ANTERIOR" e "SALDO EM CONTA"). D vira negativo.
2. Total com aplicação = saldo em conta (com sinal) + RDC automático.
3. Teste automático com este extrato: saldo final −2.412,00, aplicado 25.985,26, total 23.573,26, sem aviso de diferença.
4. Conferir se o saldo já gravado da Go Company em 28/10 foi salvo com sinal errado; se sim, corrigir e avisar.

Depois disso, basta publicar, Ctrl + Shift + R e enviar o PDF de novo (os 2 lançamentos de 28/10 que já existem continuam sendo ignorados).

## Detalhes técnicos
- `src/lib/bankStatements/parsers.ts`: parser Sicoob — sufixo C/D isolado na linha seguinte ao valor de saldo aplica sinal; mesmo para o resumo "(+) SALDO EM CONTA".
- Novo fixture + teste em `src/test/`.

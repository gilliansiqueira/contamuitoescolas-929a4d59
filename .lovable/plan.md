# Clínica Aniella: lançamentos descartados nos OFX

## Causa confirmada
Os bancos repetem o mesmo código de lançamento (FITID) em linhas diferentes, e o sistema entende a segunda linha como duplicada:
- CEF São Lucas: IOF R$ 18,65, juros R$ 33,37 e empréstimo R$ 4.911,84 vêm todos com o código `000000`, e só o primeiro fica.
- CEF Aniella: R$ 440,00 e R$ 1.250,00 (03/09) com o mesmo código `031617`; as Stone de 25/09 (R$ 10.855,58 / R$ 3.475,37) usam códigos que já aparecem em outras linhas.
- Sisprime São Lucas: a entrada Stone de R$ 1,93 (24/09) usa um código que se repete em outra linha do arquivo.

## Correção
1. Leitura do OFX: o código do banco só identifica um lançamento quando é único no arquivo e não é só zeros. Nos repetidos, a identificação passa a usar data + valor + sentido + descrição + posição, como já acontece em lançamentos iguais no mesmo dia (sem colidir).
2. Reimportação segura: reenviar os três arquivos grava só as linhas que faltam. As que já existem são reconhecidas e não se duplicam.
3. Conferência: depois da reimportação, confirmar os saldos esperados: Sisprime R$ 41,14, CEF Aniella R$ 3.040,01 e CEF São Lucas R$ 45,92.
4. Testes com os três arquivos reais: nenhuma linha descartada e saldos batendo.

## Detalhes técnicos
- `parsers.ts` (parseOFX): calcular a frequência dos FITID. Zerar `bankRef` quando o FITID se repete ou casa com `/^0+$/`.
- `computeDedupHashes` já trata lançamentos idênticos por ocorrência. Linhas antigas gravadas com hash `ref|FITID` continuam reconhecidas pelo vínculo existente (data, valor e sentido) em `BankAccountsImports`.
- Nenhuma alteração em Receita, Despesa, Resultado ou nas regras da SSOT.

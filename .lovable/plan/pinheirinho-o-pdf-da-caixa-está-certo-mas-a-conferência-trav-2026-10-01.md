# Pinheirinho: o PDF da Caixa está certo, mas a conferência trava sem motivo real

## O que encontrei
Os 6 lançamentos lidos estão corretos e batem com o saldo do banco. A conta, partindo do saldo anterior de R$ 1.127,61:

| Data | Lançamento | Saldo |
|---|---|---|
| 09/09 | Seguradora −251,45 | 876,16 |
| 14/09 | Vida e Previdência −340,34 | 535,82 |
| 25/09 | Cesta de serviço −75,00 | 460,82 |
| 28/09 | Luz −108,80 | 352,02 |
| 30/09 | Pix +10.259,71 e Prestação Hab −10.259,71 | **352,02** |

O saldo de **R$ 352,02** é igual ao do banco.

**Por que travou:** na tela, a leitura da imagem não reconheceu 3 das linhas "SALDO DIA". A conferência só soma os lançamentos dos dias que têm "SALDO DIA" lido. Por isso a cesta de R$ 75,00 de 25/09 ficou de fora da conta e apareceu como diferença em 28/09. Ou seja, o problema está na conferência, não nos lançamentos.

## O que vou mudar
1. **Somar todos os lançamentos até cada "SALDO DIA" encontrado**, inclusive os de dias em que essa linha não foi reconhecida. Com isso, a diferença falsa de R$ 75,00 some.
2. **Conferir os dias sem "SALDO DIA" pelo saldo impresso na própria linha.** Cada linha da Caixa já traz o saldo ao lado. Se esse saldo bater com a conta, o dia está conferido.
3. **Manter a trava de segurança.** A importação continua bloqueada se:
   - saldo anterior + lançamentos não der o saldo final do banco;
   - ou qualquer linha não fechar com o saldo impresso.
4. Teste automático com o texto deste PDF sem 3 linhas "SALDO DIA", simulando o que aconteceu na tela. O resultado esperado é 6 lançamentos, saldo de R$ 352,02 e importação liberada.
5. Publicar no site oficial. Depois, a equipe reenvia o mesmo PDF.

## Detalhes técnicos
- Em `parseCaixaImageText` (`parsers.ts`):
  - guardar o saldo da própria linha (`m[7]`/`m[8]`) em cada row;
  - no laço, aplicar todas as rows com `data <= dia` ainda não aplicadas;
  - validar as rows de dias sem `saldosDia` pelo saldo da linha no fechamento do dia;
  - exigir que `saldoAnterior + mov` seja igual ao último saldo conhecido.
- Novo teste em `bankCaixaImagePdf.test.ts`, usando a fixture sem as linhas de 09/09, 14/09 e 25/09.

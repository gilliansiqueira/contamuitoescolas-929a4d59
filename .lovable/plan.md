# Fazenda Rio Grande – Bradesco não bate (-136,10 em conta / 22.201,85 aplicado)

## O que encontrei
- **Hoje só o PDF foi gravado, e ele foi lido errado.** Dos 13 lançamentos de 02/10 a 06/10, entraram só 2 (resgate automático 605,03 e Bradsaúde 137,10). Faltam os tributos (621,75, 150,60, 721,66), as transferências para Any Claudia (314,40 e 1.100,00), o Pix para Jean (800,00), a Stone de 384,97, o Pix da Driele (110,00) e o resgate de CDB de 2.325,83.
- **O saldo do PDF foi lido como R$ 0,00.** O leitor pegou a linha "Saldo Invest Fácil 0,00" em vez do saldo final de -136,10. Como o arquivo não informa o aplicado, o sistema usou esse zero como saldo em conta. Por isso a tela mostra números sem sentido.
- **O Bradesco repete lançamentos no OFX.** O resgate de CDB de 2.325,83 aparece duas vezes no arquivo (mesmo documento 2741711). No PDF fica claro que é o mesmo lançamento, mostrado nas duas partes do extrato ("período" e "últimos lançamentos"). Em 30/09 há um caso parecido: um resgate de CDB de 3.768,01 está gravado duas vezes, uma vinda de cada OFX. Vou conferir se ele foi contado em dobro.

## O que vou fazer
1. **Leitor do PDF do Bradesco:** ler as duas partes do extrato, com descrições quebradas em duas linhas. Não repetir o que aparece nas duas partes. Usar como saldo final o último saldo impresso (-136,10) e nunca o "Saldo Invest Fácil". Testar com este PDF: 13 lançamentos e saldo final de -136,10.
2. **Leitor do OFX do Bradesco:** quando duas linhas forem iguais em data, valor, descrição e número do documento, gravar só uma, avisando na prévia.
3. **Corrigir os dados da Fazenda:**
   - excluir a importação do PDF de hoje (com as 2 linhas dela);
   - importar o extrato de hoje já corrigido, com os lançamentos que faltam e sem repetições;
   - gravar o saldo de 06/10 como -136,10 em conta e 22.201,85 aplicado;
   - conferir o 3.768,01 de 30/09 e, se estiver em dobro, remover a cópia. Isso fica registrado no histórico.
4. Conferir que o Bradesco fecha nos valores certos e publicar.

## Ponto para você confirmar
O PDF mostra "Total Disponível R$ 22.201,85". Vou seguir o que você disse: em conta -136,10 e aplicado 22.201,85. Com isso, o total da conta fica em R$ 22.065,75. Se os 22.201,85 forem o total (conta + aplicado), o aplicado seria 22.337,95. Me avise se for esse o caso.

## Detalhes técnicos
- `parsers.ts`: o parser do PDF Bradesco precisa tratar o bloco "Últimos Lançamentos" e a descrição na linha anterior ao valor, ignorar "Saldos Invest Fácil / Plus" e tirar `saldoFinalInformado` do último saldo. Deduplicar entre seções por data+documento+valor. Novo teste com fixture do texto do PDF.
- OFX Bradesco: dedupe intra-arquivo por DTPOSTED+TRNAMT+CHECKNUM+MEMO, com FITID diferente.
- Dados: delete cascade do import `Bradesco_06102026_091616.PDF`. Inserir linhas com `origem`/import rastreável, `saldo_final_informado=-136.10`, `saldo_aplicado_informado=22065.75` (total), `audit_log` e `sync_bank_cashflow_school`.
- Proteção: em `useBankPilot`, não aceitar como âncora um saldo 0 de PDF quando o próprio arquivo tiver lançamentos que não fecham com ele.

# Bairro Alto: aviso "suba o extrato mais recente" mesmo após envio

## O que confirmei
- O aviso aparece porque o sistema corta o realizado no dia da conta mais atrasada. Em Bairro Alto são duas:
  - **Banco do Brasil:** o PDF foi emitido em 29/09, mas o último movimento é de 21/09, porque não houve movimento depois disso. O sistema usa a data do último lançamento e entende que o extrato "vai só até 21/09".
  - **Portão 3:** o arquivo se chama "01-09-2026_30-09-2026", mas o último lançamento é de 22/09. Acontece a mesma coisa.
- Além disso, a leitura do PDF do BB gravou o período como 10/09 a 10/09, com saldo de R$ 1.388,88. O PDF, porém, lista os dias do mais novo para o mais antigo e mostra saldo de R$ 4.862,01 em 21/09. A leitura desse modelo de PDF está errada.

## O que vou fazer
1. **Cobertura do extrato:** considerar que a conta está atualizada até a data de emissão ou o fim do período informado no arquivo, e não só até o último lançamento. Assim, um extrato sem movimento depois de 21/09, emitido em 29/09, conta como "atualizado até 29/09" e o aviso some.
2. **PDF do BB em ordem invertida:** corrigir a leitura para aceitar dias listados do mais novo para o mais antigo. O período passa a ser 10/09 a 29/09 e o saldo, o "Saldo do dia" mais recente (R$ 4.862,01 em 21/09, mantido até 29/09). Teste automático com esse PDF.
3. **Corrigir a importação já gravada:** atualizar o período e o saldo desse extrato do BB, com registro no histórico, e conferir se todos os lançamentos do PDF estão no sistema, sem faltar e sem duplicar.
4. **Portão 3:** usar o período do arquivo (até 30/09) como cobertura, se o arquivo trouxer essa informação. Se não trouxer, o aviso passa a indicar a conta e a data exatas.
5. Conferir na tela e publicar.

## Detalhes técnicos
- `bank_statement_imports.periodo_fim` passa a ser a data de cobertura (emissão ou fim do período do arquivo), e o corte (`holder`/`bankTo`) usa o maior valor entre `periodo_fim` e o último lançamento, por conta.
- `parsers.ts`: parser BB PDF com ordenação por data e "Saldo do dia" mais recente; data de emissão ("Data de emissão"/"Impresso em") vira o fim do período. Fixture a partir de `extrato-09-2026.pdf`.
- Nenhuma mudança em Receita, Despesa ou Resultado.

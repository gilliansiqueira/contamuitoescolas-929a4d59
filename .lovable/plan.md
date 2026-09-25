# Extrato do Banco do Brasil em PDF: importar tudo, não só os futuros

## O que está acontecendo
Não é travamento. Hoje, quando o PDF é do Banco do Brasil, o sistema foi montado para trazer **só os lançamentos futuros e os saldos**. A ideia era que os lançamentos já feitos viessem do arquivo OFX. Como na Jurassic e nas Uberlândias vocês sobem só o PDF, os lançamentos do mês não entram.

Na imagem da Jurassic também aparecem dois erros de leitura:
- "Saldo final informado pelo banco: R$ 6,50": esse é o valor da tarifa pendente, não o saldo da conta.
- "Tarifas Pendentes 0" entrou como lançamento, mas é só uma linha do resumo do banco.

## O que vou mudar
1. **PDF do BB traz os lançamentos já feitos** do período, além dos futuros (que continuam como "Previsto — aguardando extrato").
2. **Sem duplicar quem já usa OFX:** antes de gravar, o sistema compara cada linha com o que já existe na conta (mesma data, valor e sentido). O que já veio do OFX aparece na conferência como "já existe" e não é gravado de novo.
3. **Saldo correto:** o saldo vem da linha "S A L D O" do dia, e a aplicação (Rende Fácil ou fundos) é somada quando existir. Linhas de resumo como "Tarifas Pendentes" e "Saldo aprovisionado" deixam de ser lidas como saldo ou como lançamento.
4. **Conferência que fecha:** saldo anterior + entradas − saídas precisa bater com o saldo final do PDF. Se não bater, aparece um aviso antes de importar, com a diferença.
5. Dourados continua funcionando como hoje: vou testar de novo com o PDF de 25/09 que já temos.

## O que preciso de você
Os PDFs do BB da Jurassic e de uma das Uberlândias. Vou usar esses arquivos para testar a leitura antes de liberar.

## O que não muda
- Histórico antes de 01/09/2026, Dashboard, Fluxo Diário e cálculos oficiais.
- Importações já feitas: nada é regravado.

## Sobre os R$ 12,28 de Dourados
Como o Bradesco está descartado, a próxima coisa a olhar é o Sicredi (conta e aplicação). Faço isso junto, direto nos dados, e mostro as linhas exatas.

## Detalhes técnicos
- `parsePdfLines` (src/lib/bankStatements/parsers.ts): quando `isBB`, devolver `txs + futuros` em vez de só `futuros`; aplicar a conferência de saldo (hoje só roda quando `!isBB`) também ao BB; ignorar `tarifas pendentes` e outras linhas de resumo; não aceitar valor vindo de linha de resumo como `saldoConta`.
- Deduplicação contra lançamentos existentes da conta pela `dedup_hash` que já existe e por data+valor+sentido (reaproveitando a regra de troca do previsto pelo real), marcando essas linhas como "já existe" na conferência.
- Testes vitest novos com fixtures das PDFs da Jurassic e de Uberlândia, e o teste `bankBbPdfFundos` de Dourados mantido.

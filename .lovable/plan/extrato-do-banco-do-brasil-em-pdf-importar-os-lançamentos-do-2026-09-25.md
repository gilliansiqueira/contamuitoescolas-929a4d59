# Extrato do Banco do Brasil em PDF: importar os lançamentos do mês, não só os futuros

## O que está acontecendo (conferido no extrato da Jurassic)
Não é travamento. Hoje, quando o PDF é do Banco do Brasil, o sistema foi montado para trazer **só os lançamentos futuros e o saldo**. A ideia era que os lançamentos já feitos viessem do arquivo OFX. Como na Jurassic e nas Uberlândias vocês sobem só o PDF, os cerca de 80 lançamentos de 01/09 a 25/09 ficaram de fora.

O resto da tela estava certo:
- **Saldo de R$ 6,50:** está correto. A linha "SALDO" de 25/09 mostra 6,50 C.
- **Tarifas Pendentes R$ 6,50:** é uma cobrança real que o banco vai fazer. Por isso o próprio banco mostra o saldo como 0,00 depois dela. Ela continua entrando como prevista.

## O que vou mudar
1. **O PDF do BB passa a trazer todos os lançamentos já feitos** do período: data, descrição, valor e se é entrada (C) ou saída (D). Os futuros continuam entrando como "Previsto — aguardando extrato".
2. **Descrição mais útil:** junto com o histórico ("Pix - Recebido", "Pagto Energia Elétrica"), vou aproveitar a linha de baixo, que traz o nome de quem pagou ou recebeu (ex.: "PLUXEE BENEFIC", "COPEL DISTRIBUICAO").
3. **Sem duplicar quem já usa OFX:** se a mesma movimentação (mesma data, valor e sentido) já existir na conta, a conferência mostra como "já existe" e ela não é gravada de novo.
4. **Conferência que fecha:** saldo anterior (R$ 999,04) + entradas − saídas precisa dar o saldo final (R$ 6,50). Se não fechar, aparece um aviso com a diferença antes de importar.
5. **Dourados continua funcionando como hoje:** vou testar de novo com o PDF de 25/09 que já temos (Rende Fácil e pagamento do cartão).

## O que não muda
- Histórico antes de 01/09/2026, Dashboard, Fluxo Diário e cálculos oficiais.
- Importações já feitas: nada é regravado. Depois da correção, basta subir de novo o PDF da Jurassic e das Uberlândias. Os 4 futuros que já entraram não vão se repetir.

## Sobre os R$ 12,28 de Dourados
Com o Bradesco fora da conta, o próximo lugar a olhar é o Sicredi (conta e aplicação). Faço isso junto, direto nos dados, e mostro as linhas exatas.

## Detalhes técnicos
- `parsePdfLines` (src/lib/bankStatements/parsers.ts): no layout BB, ler o valor do lançamento como o primeiro valor com marcador C/D (o segundo é o saldo do dia), usar o marcador para definir o sentido, anexar à descrição a linha de complemento seguinte, e devolver `txs + futuros` em vez de só `futuros`.
- Aplicar ao BB a conferência saldo anterior + movimento = saldo final (hoje ela só roda para os outros bancos).
- Deduplicação contra lançamentos já existentes da conta (dedup_hash e data+valor+sentido), marcando essas linhas como "já existe" na prévia.
- Fixture `src/test/fixtures/bbJurassic2509.json` com teste vitest: fecha 999,04 → 6,50 e traz 4 futuros. O teste `bankBbPdfFundos` de Dourados continua passando.

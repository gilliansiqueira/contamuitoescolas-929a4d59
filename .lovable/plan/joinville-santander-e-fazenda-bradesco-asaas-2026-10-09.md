# Joinville (Santander) e Fazenda (Bradesco + Asaas)

## O que encontrei

**Fazenda – a "Transferência sem par" de R$ 10.137,64 (07/10)**
- O Pix aparece no Bradesco como entrada, mas a saída do Asaas nunca foi gravada no sistema.
- O extrato do Asaas de 07/10 foi baixado às 16:56, antes desse Pix sair. O extrato seguinte começa em 08/10. Por isso o dia 07/10 ficou incompleto.
- O cartão do Asaas "bate" porque mostra o saldo impresso no último extrato. Mesmo assim, faltam 4 lançamentos no sistema:
  - Pix para A C FERREIRA, −R$ 10.137,64
  - Felipe Daniel, +R$ 292,80, com a taxa de −R$ 1,30
  - taxa de WhatsApp de 09/10, −R$ 0,55
- O arquivo "Extrato_Asaas_6" que você mandou tem todos eles. As outras 150 linhas já estão no sistema.

**Fazenda – Bradesco**
- Faltam 6 lançamentos de 07/10, que estão no OFX de hoje:
  - um resgate de CDB de R$ 4.901,02 (o banco mostra dois iguais; só um entrou)
  - Antonio Guilherme, −R$ 1.262,00
  - Pix para Yasmin, −R$ 372,00
  - três contas de luz Copel: −R$ 104,61, −R$ 89,48 e −R$ 69,63
- O OFX do Bradesco mostra um único saldo, R$ 17.609,69. O sistema trata esse número como "em conta" e ainda soma por cima um aplicado calculado. Isso infla o saldo. Foi o que aconteceu ontem: R$ 8.865,24 em conta + R$ 8.321,60 aplicado.
- Os resgates do CDB estão marcados de formas diferentes: alguns como Operação, outros como movimento normal. Nenhum está marcado como resgate da aplicação. As aplicações no CDB não aparecem no OFX. Por isso não dá para separar "em conta" de "aplicado" só pelos lançamentos.
- Os valores não fecham entre si:
  - os seus: −R$ 3.002,30 em conta + R$ 19.002,88 aplicado = R$ 16.000,58
  - PDF de 08/10: R$ 498,78 em conta e R$ 17.606,32 de "total disponível"
  - OFX: R$ 17.609,69
- Sem um extrato que mostre o saldo do CDB separado, eu estaria chutando a divisão entre "em conta" e "aplicado".

**Joinville – Santander**
- As duas Joinville (Centro e Norte) têm a conta Santander cadastrada, mas nenhum extrato foi gravado até hoje.
- O sistema ainda não tem leitura própria para o Santander. Preciso do arquivo que não sobe e do formato (PDF, OFX ou Excel) para corrigir.

## O que vou fazer
1. **Fazenda – completar os lançamentos:** importar os dois arquivos que você mandou pela própria tela de extratos, para guardar de onde veio cada linha.
   - A prévia deve mostrar só 4 linhas novas no Asaas e 6 no Bradesco. Se mostrar outra coisa, paro antes de gravar.
   - Com a saída do Asaas gravada, o Pix de R$ 10.137,64 forma par automaticamente e sai de "Transferências sem par".
2. **Fazenda – saldo do Bradesco:**
   - Para extratos do Bradesco em conta com aplicação, o saldo do OFX passa a valer como **total** (conta + aplicado), e não mais como "em conta".
   - Marcar "RESG/VENCTO CDB" e "RESG AUTOMATICO" como resgate da aplicação, no passado e nos próximos arquivos. Assim deixam de contar como entrada de dinheiro novo.
   - Gravar o saldo conferido com o número que você confirmar.
3. **Joinville – Santander:** com o arquivo em mãos, criar a leitura do Santander e um teste automático com ele. Depois importar em Centro e Norte, conferindo com o saldo impresso.
4. Mostrar o antes e depois de cada conta.

## O que preciso que você me mande
- **Joinville:** o extrato do Santander que não sobe (de cada empresa, se forem diferentes) e, se aparecer, um print da mensagem de erro.
- **Fazenda – Bradesco:** o extrato de 01/09 a 08/10 em PDF, com a parte de **Investimentos / CDB / Invest Fácil**, ou um print do saldo de investimentos em 31/08 e em 08/10. Me diga também de qual tela saíram os −R$ 3.002,30 e R$ 19.002,88.

## Detalhes técnicos
- Dados: importação via UI (Playwright) em `bank_statement_imports`/`bank_transactions`; depois `autoPairTransfers` e `sync_bank_cashflow_school`. Âncora em `bank_account_balances` só após confirmação. Contas: Bradesco `5b844b55…`, Asaas `b07c274c…`, Santander `37ecf0a0…` / `f8b15eac…`.
- Código: em `fetchBankAccounts` (`useBankPilot.ts`), OFX do Bradesco (BANKID 0237) em conta com `has_auto_invest` grava o saldo como total. O "em conta" vem do cálculo, limitado a ≥ 0, e o aplicado é total − em conta. Padrões "resg/vencto cdb" e "resg automatico" em `bank_auto_invest_patterns` da Fazenda. Correção de `movement_kind` dos resgates existentes para `auto_resgate`, com registro em `audit_log`. Parser Santander em `parsers.ts` com fixture e teste em `src/test/bankSantander*.test.ts`.
- Regras mantidas: Operação afeta só o Caixa, sem duplicar a SSOT, e Brasília não é alterada.

# Saldos: Bradesco de Fazenda, Sicredi de Portão e saldo inicial de Brasília

## O que encontrei
**Portão – Sicredi (deveria fechar em R$ 17.855,81 em 08/10)**
- O sistema bate com o banco até 05/10 (R$ 34.347,96) e também com o PDF de 06/10 (R$ 14.903,36).
- A diferença começa no OFX de 07/10, "extrato (12)": ele trouxe 3 Pix com data de 06/10 que não estão no PDF de 06/10 (Paulo Henrique R$ 4.932,95, Letícia R$ 3.870,60, Brendha R$ 3.248,10, total R$ 12.051,65).
- Pelos saldos que o próprio banco informou, falta uma entrada de **R$ 8.497,48** (ou alguns desses Pix não deveriam ter saído). Desde então a diferença é sempre essa: 07/10 e 08/10.

**Fazenda – Bradesco (deveria ser −R$ 3.002,30 em conta e R$ 19.002,88 aplicado)**
- Os lançamentos de 05/10 entraram duas vezes, uma do PDF de 06/10 e outra do OFX de 07/10, porque o texto muda ("TRANSF CC PARA CC - ANY..." × "TRANSF CC PARA CC ANY..."): R$ 1.100,00, R$ 605,03, R$ 384,97 e R$ 110,00.
- O resgate de R$ 605,03 aparece como "RESG AUTOMATICO" no PDF e como "RESG/VENCTO CDB" no OFX. Por isso o aplicado fica errado: a mesma linha conta como movimento da aplicação e como movimento normal.
- A conta está sem nenhum saldo conferido salvo. Hoje o saldo sai só do saldo inicial (R$ 1,00 em conta e R$ 6.097,57 aplicado em 31/08) mais os lançamentos.

**Brasília (saldo inicial de setembro: R$ 105.900,09 × R$ 104.283,88)**
- A diferença é exatamente **R$ 1.616,21**, que é o saldo inicial "em conta" da Caixa em 31/08. As demais contas somam o valor que você indicou: Asaas R$ 53.398,57, BB R$ 38.227,15 e aplicado da Caixa R$ 12.658,16.

## O que vou fazer
1. **Fazenda:** ler o PDF de 08/10 e conferir linha a linha com o que está gravado desde 30/09. Depois:
   - remover as cópias de 05/10, mantendo a versão conciliada, com o motivo no histórico;
   - classificar o R$ 605,03 de forma que a mesma linha não conte duas vezes;
   - gravar o saldo conferido: −R$ 3.002,30 em conta e R$ 19.002,88 aplicado, na data do extrato.
2. **Portão:** conferir os 3 Pix de 06/10 e achar os R$ 8.497,48.
   - Se for lançamento que faltou, incluo com origem rastreável.
   - Se for Pix que não saiu, removo com o motivo registrado.
   - Depois gravo o saldo de 08/10 em R$ 17.855,81.
3. **Brasília:** tirar os R$ 1.616,21 do saldo inicial em conta da Caixa (passa a R$ 0,00 em 31/08). O saldo inicial de setembro vai para R$ 104.283,88.
4. **Proteção para o futuro:** na importação, PDF e OFX do mesmo dia passam a se reconhecer mesmo com hífen ou palavras diferentes ("RESG AUTOMATICO" × "RESG/VENCTO CDB" com o mesmo valor e data), sem juntar Pix de pessoas diferentes. Teste automático com os casos de Fazenda.
5. Mostro o antes e depois de cada conta.

## Pontos para você confirmar
- **Portão:** os 3 Pix de 06/10 (Paulo, Letícia, Brendha) saíram mesmo? Se puder, mande o extrato do Sicredi de 06 e 07/10 (o "extrato (12)") para eu achar os R$ 8.497,48.
- **Brasília:** ao zerar o saldo inicial em conta da Caixa, o saldo da Caixa no fim de setembro também cai R$ 1.616,21. Antes ele fechava com o extrato em R$ 7.269,37. Esses R$ 1.616,21 já estão dentro do aplicado da Caixa?
- **Fazenda:** os valores −R$ 3.002,30 / R$ 19.002,88 são do extrato de 08/10?

## Detalhes técnicos
- Dados (sem migração): `delete_bank_tx` para as cópias; `bank_accounts.saldo_inicial` da Caixa (`99c1f0f6…`); inserir âncoras em `bank_account_balances` para o Bradesco (`5b844b55…`) e o Sicredi (`c5564ae8…`); `audit_log` e `sync_bank_cashflow_school`.
- Código: em `matchRenumberedRefs`/`sameRefTx` (`parsers.ts`), normalizar hífens e aceitar "RESG AUTOMATICO" ≡ "RESG/VENCTO CDB" só quando data, valor e sentido são iguais e vêm de arquivos diferentes; teste em `src/test/itauRefRenumbered.test.ts`.

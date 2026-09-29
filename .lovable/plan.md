# Farmácia Magistral: diferença de R$ 6.924,89 no Inter

## O que foi conferido
- Os 2.570 lançamentos do OFX estão gravados no sistema, sem nenhum faltando ou repetido.
- Saldo inicial de R$ 37.407,51 mais os lançamentos dá **R$ 36.304,65 em 28/09**, o mesmo "Saldo do dia 28/09" do PDF do Inter. O cálculo do sistema está certo.
- A diferença vem do saldo informado no arquivo. O OFX do Inter traz R$ 43.229,54 com data de **29/09**, o dia em que o arquivo foi baixado. Esse saldo já inclui movimentos de 29/09 que não estão no extrato. O sistema usou esse valor como se fosse o saldo de 28/09.
- A importação anterior (até 25/09) teve o mesmo problema: o arquivo informava R$ 62.522,36, mas o saldo real de 25/09 era R$ 56.225,87 (confere com o PDF).

## Correção
1. Na leitura do OFX, o saldo do arquivo só vale como saldo final quando a data dele é a mesma do último dia do extrato. Se for posterior, ele aparece apenas como informação ("saldo do banco em 29/09, não usado na conferência") e não vira saldo conferido.
2. Nas duas importações do Inter da Farmácia Magistral, corrigir o saldo informado para o valor real da data, com registro no histórico de auditoria:
   - até 25/09: R$ 56.225,87
   - até 28/09: R$ 36.304,65
3. Resultado esperado na tela: Inter com **R$ 36.304,65**, "em conta: confere em 28/09/2026", e consolidado **R$ 6.924,89 menor** (R$ 132.132,22).
4. Testes com o OFX real do Inter.

## Detalhes técnicos
- `parsers.ts` (parseOFX): ler `LEDGERBAL/DTASOF`. Quando for maior que `periodoFim`, não preencher `saldoFinalInformado`; guardar o valor em `saldoAtualCabecalho` (já exibido como "não usado") e adicionar um aviso.
- Correção de dados em `bank_statement_imports.saldo_final_informado` (ids `05d46a0b…` e `fd4d4188…`), com linha em `audit_log`.
- Receita, Despesa, Resultado e as regras da SSOT não mudam.

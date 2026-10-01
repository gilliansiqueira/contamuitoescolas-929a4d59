# Floripa Ingleses: diferença de R$ 50,00 (Itaú)

## Causa confirmada
- O Asaas está certo. A diferença fica só no Itaú: o sistema mostra -R$ 2.624,76 e o extrato de 01/10 mostra -R$ 2.574,76.
- Ficou faltando o **Pix recebido de LEONARDO PADILHA CARVALHO, de R$ 50,00, em 30/09**.
- Motivo: o Itaú muda a numeração dos lançamentos a cada download.
  - No extrato de 30/09, o código 20260930014 era o pagamento CASAN de R$ 311,81.
  - No extrato de 01/10, o mesmo código passou a ser o Pix do Leonardo, e o CASAN virou 20260930013.
  - O sistema viu o código repetido e descartou o Pix achando que já existia. É o mesmo problema que já corrigimos no Bradesco de Dourados.

## Correção
1. Incluir o Pix de R$ 50,00 do Leonardo (30/09) no Itaú de Floripa Ingleses, ligado ao extrato de 01/10, registrar no histórico e atualizar o fluxo. O saldo deve fechar em -R$ 2.574,76.
2. Para todas as empresas, na importação do Itaú, um lançamento só será considerado repetido se também tiver a mesma data, o mesmo valor, o mesmo sentido e a mesma descrição. O código do banco sozinho não basta.
3. Criar um teste automático com os dois casos reais: o CASAN e o Leonardo usando o mesmo código.
4. Conferir nas outras empresas com Itaú se algum lançamento foi descartado do mesmo jeito: comparar as entradas e saídas de cada arquivo com o que ficou gravado no sistema.

## Detalhes técnicos
- Na conferência de duplicados em `BankAccountsImports`/`parsers` (`computeDedupHashes`), quando um `bank_ref` já gravado tiver data, valor, tipo ou descrição diferentes, o lançamento deve ser tratado como novo.
- Para a inclusão, usar `run_sql` com o `import_id` do arquivo de 01/10 e `bank_ref` nulo, para não colidir com o código antigo. Depois, registrar em `audit_log` e rodar `sync_bank_cashflow_school`.
- Receita, Despesa, Resultado e as regras da SSOT não mudam.

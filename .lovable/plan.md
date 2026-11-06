# Manaus Laranjeiras — saldo do Bradesco errado no Fluxo Bancário

## O que já encontrei nos extratos gravados
- Foram enviados 26 arquivos OFX do Bradesco, muitos cobrindo os mesmos dias (ex.: três arquivos terminando em 05/11).
- O Bradesco muda o código e às vezes o texto do mesmo lançamento entre um arquivo e outro, então 4 lançamentos entraram em dobro:
  - 05/11 entrada R$ 17.180,63 ("TRANSF.MMA.TITULARIDADE" e "TRANSF.AUTORIZ.ENTRE C/C" — mesmo resgate com nomes diferentes)
  - 03/11 PIX Vanessa de Araujo R$ 296,00
  - 04/11 PIX Agata Oliveira R$ 80,00
  - 04/11 PIX Urban Comércio R$ 296,00
  - Total a mais: R$ 17.852,63
- Os resgates automáticos do Invest Fácil ("TRANSF.MMA.TITULARIDADE") aparecem como entrada; preciso confirmar se o saldo informado no OFX inclui ou não a aplicação, porque os saldos finais dos arquivos do mesmo dia não batem entre si (R$ 28.681,93, R$ 1.835,08 e R$ 28.660,67 em 05/11).
- Ainda não sei se só as duplicidades explicam a diferença até R$ 344,88; isso é o primeiro passo.

## O que vou fazer
1. Refazer o saldo dia a dia desde 30/09 só com os lançamentos gravados e comparar com os saldos impressos em cada arquivo, achando exatamente em que dia e em quais linhas a conta deixa de fechar até chegar em R$ 344,88.
2. Remover as cópias repetidas (mantendo a linha original e qualquer conciliação já feita), com registro no histórico.
3. Se aparecer outra causa (resgate/aplicação contada errado, lançamento futuro, saldo âncora errado), corrigir apenas o que os extratos comprovarem e mostrar para você as linhas antes de mudar.
4. Corrigir a regra de importação para não repetir: o mesmo dia + mesmo valor + mesmo sentido vindo de arquivos diferentes do Bradesco, com texto equivalente (incluindo o par MMA TITULARIDADE / AUTORIZ. ENTRE C/C), passa a ser reconhecido como o mesmo lançamento — sem juntar dois PIX reais do mesmo valor no mesmo arquivo.
5. Teste automático com os casos reais acima.

## Detalhes técnicos
- Dados: `bank_transactions` / `bank_statement_imports` da conta Bradesco da escola; exclusão via migração com auditoria, preservando `recon_*`, `model_item_id` e `transfer_pair_id` da linha mantida.
- Regra: estender `sameBankEntryText` (dedup entre imports) com equivalência Bradesco MMA/AUTORIZ e checagem por import (contagem por arquivo) para não colapsar PIX legítimos repetidos.
- Teste novo em `src/test/` com as linhas de 03–05/11.

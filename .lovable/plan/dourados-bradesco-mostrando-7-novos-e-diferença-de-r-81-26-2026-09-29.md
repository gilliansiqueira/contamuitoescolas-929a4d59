# Dourados: Bradesco mostrando "7 novos" e diferença de R$ 81,26

## O que encontrei
- Os 7 lançamentos do arquivo **já estão todos no sistema** (mesmas datas, valores e descrições).
- O Bradesco **mudou o número de identificação** de cada lançamento entre um download e outro (ex.: consórcio de 04/09 era N10115, agora veio N10122). Como o número mudou, o sistema achou que eram lançamentos novos e ia gravar tudo de novo.
- Por isso o saldo calculado ficou errado e apareceu o botão "Tratar R$ 81,26 como aplicação". **Não é aplicação.**
- Saldo real pelo PDF: **R$ 78,54** em 18/09 (sem movimento até 29/09). O arquivo diz R$ 78,55: 1 centavo de rendimento, dentro da tolerância.

**Importante:** não clique em "Confirmar importação" nem em "Tratar como aplicação" com esse arquivo até a correção.

## O que vou fazer
1. Na conferência, quando o número do banco for diferente mas existir na mesma conta um lançamento com **mesma data, mesmo valor, mesmo sentido e mesma descrição**, tratar como "já existe" e não gravar de novo.
2. Para não repetir o erro da Clínica Aniella (bancos que repetem números em lançamentos diferentes), cada linha existente só pode ser reaproveitada uma vez: dois lançamentos iguais no mesmo dia continuam sendo dois.
3. Ao confirmar, só atualizar a referência bancária das linhas reconhecidas; nenhum valor é alterado.
4. Resultado esperado para este arquivo: **0 novos, 7 já existentes**, saldo R$ 78,54 confere (1 centavo a confirmar), sem aviso de aplicação.

## Detalhes técnicos
- `BankAccountsImports.tsx`: no casamento de duplicados, após falhar por `bank_ref`, cair no casamento por (account_id, data, valor, tipo, descrição normalizada), consumindo cada linha existente uma única vez (contagem por chave). Hoje o fallback só aceita linhas com `bank_ref` nulo.
- Ao confirmar, `update bank_transactions set bank_ref = novo` apenas nas linhas casadas.
- Teste em `src/test/` com este OFX contra as 7 linhas atuais (N101xx antigos) e um caso com dois lançamentos idênticos no mesmo dia.
- Publicar no site oficial depois.

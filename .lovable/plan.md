# Praia da Costa – transferências entre contas não identificadas

## Causa (confirmada)
- Nomes cadastrados: "influx ingles e espanhol" e "wl excelencia em idiomas ltda".
- No Itaú a descrição vem como "INFLUX **-** INGLES E ESPANHOL". A comparação de nomes não ignora o hífen, então "influx ingles e espanhol" nunca bate e o lado do Itaú fica como Receita.
- O lado da Stone ("WL EXCELENCIA EM IDIOMAS LTDA") só foi importado em 25/11, antes de os nomes serem cadastrados (26/11), por isso também ficou como Despesa.
- Resultado: o par de 24/11 de R$ 774,66 (saída Stone × entrada Itaú) está pendente e sem par. Os pares anteriores de novembro já estavam pareados.

## Correção
1. Comparação de nomes da própria empresa passa a ignorar pontuação (hífen, ponto, barra) nos dois lados — vale para todas as empresas, na importação e no botão "Marcar lançamentos já importados".
2. Marcar o par de 24/11 (R$ 774,66) como transferência entre contas e parear as duas pontas, sem alterar valores.
3. Teste pequeno: "INFLUX - INGLES E ESPANHOL" é reconhecido pelo nome "influx ingles e espanhol"; nome de outra empresa não é.
4. Conferir na tela de Movimentações de Praia da Costa que as duas linhas aparecem como Transferência.

## Detalhes técnicos
- `detectOwnTransfer` em `src/lib/bankStatements/bankCashflowEngine.ts`: normalizar com `replace(/[^\p{L}\p{N}]+/gu, ' ')` antes do `includes`. Única implementação (a Edge Function de importação não tem cópia).
- Dados: `movement_kind='transferencia'` nas duas linhas + `autoPairTransfers` / mesmo `transfer_pair_id`.
- Teste em `src/test/` na suíte existente.

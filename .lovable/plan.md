# Pinheirinho: alternativa ao PDF da Caixa

## Primeira opção (sem mudar nada)
A Caixa permite baixar o extrato em **OFX** no internet banking (é o que Brasília já usa e funciona bem). Se a Pinheirinho conseguir baixar o OFX, ele entra direto, com o saldo conferido.

## O que será feito
1. **Modelo de planilha da Caixa para baixar**: em Contas e Extratos, botão "Baixar modelo Excel" com as colunas Data, Descrição, Entrada, Saída, Saldo do dia, além da linha "Saldo anterior" no topo.
2. **Leitura da planilha preenchida**: o sistema lê o modelo e confere linha por linha. Só deixa importar se o saldo anterior mais os lançamentos fecharem com o saldo de cada dia e com o saldo final. Se não fechar, mostra em qual linha está a diferença e não grava nada.
3. **Saldo atualizado sem lançamentos (último recurso)**: opção "Informar saldo da conta numa data" para quando não houver extrato. Esse valor serve só como saldo conferido. Não cria lançamentos, então a conta fica marcada como "sem extrato" na conciliação daqueles dias.
4. Testar com os dados de setembro da Pinheirinho (saldo anterior R$ 1.127,61).

## Detalhes técnicos
- O modelo é gerado com `xlsx` no navegador. Ele fica com cabeçalho fixo e é detectado em `parsers.ts` antes de `parseLooseCashSheet`. O sentido do lançamento vem da coluna (Entrada ou Saída), nunca do sinal do valor.
- Usar a mesma rastreabilidade de upload (`bank_statement_imports`, `formato='xlsx'`, `banco='Caixa'`). `saldo_final_informado` recebe o último saldo da planilha.
- O item 3 grava um registro em `bank_statement_imports` sem linhas (`total_linhas=0`), com `saldo_final_informado` e `periodo_fim`. Só administradores podem usar, e cada uso fica no `audit_log`.
- Nada muda na classificação nem nos motores SSOT.

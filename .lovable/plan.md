# Auditoria completa dos saldos de Dourados (todas as contas)

## O que já foi visto
Os últimos extratos importados (até 25/09) trazem saldos que precisam ser explicados conta a conta:
- Banco do Brasil: em conta -190,53 e aplicado 148.992,18 (o extrato anterior, até 24/09, dizia 1.200,80 em conta e 150.728,00 aplicado).
- Sicredi: em conta -289,41, sem saldo aplicado informado.
- Inter: 57.418,04 (o extrato anterior, até 23/09, dizia 49.239,15).
- Stone: 0,00 (anterior 3,70).
- Bradesco: 78,54 (até 18/09).

A diferença mudou porque foram importados extratos novos e a regra passou a usar o saldo do extrato. Isso ainda não prova que está tudo certo. Não vou dizer que está certo antes de conferir linha a linha.

## O que vou fazer (somente leitura, sem alterar nenhum lançamento)
1. Para cada conta, montar a conta completa: saldo de 31/08 + entradas - saídas (por dia) = saldo calculado. Comparar com o saldo de cada extrato importado, inclusive os anteriores.
2. Quando não bater, mostrar exatamente quais linhas causam a diferença: duplicadas entre um extrato e outro (o BB novo acusou 1 duplicada), dias faltando entre extratos, aplicações/resgates automáticos lidos com o sinal trocado, rendimentos que não vieram e transferências internas.
3. Conferir o saldo em conta negativo (BB e Sicredi): confirmar se o extrato mostra mesmo negativo coberto pela aplicação ou se o arquivo foi lido errado.
4. Entregar uma tabela por conta: saldo do extrato, saldo calculado, diferença e as linhas responsáveis.

## Depois da auditoria
- Se a causa for leitura errada do arquivo ou duplicidade, proponho a correção e mostro antes o impacto.
- Se for só rendimento/centavos ainda não lançados, isso fica em "A confirmar no próximo extrato", sem travar o Dashboard.
- Histórico antes de 01/09/2026 continua intocado.

## Detalhes técnicos
- Fontes: bank_statement_imports (saldo_final_informado, saldo_aplicado_informado, periodo_fim, duplicadas), bank_transactions por account_id/data, bank_accounts (saldo_inicial, auto_invest_saldo_inicial).
- Reproduzir o cálculo de accountBalances em bankCashflowEngine com os mesmos dados e comparar dia a dia com cada extrato.
- Nenhuma escrita no banco nesta etapa.

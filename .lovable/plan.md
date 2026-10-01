# Operações do Fluxo Bancário contadas como despesa no Dashboard (Piraquara)

## O que foi confirmado
- Os 3 lançamentos de setembro (Pix Vanessa R$ 7.000,00, Déb. Empréstimo R$ 4.355,22 e Pix Eugenio R$ 32.000,00) estão gravados no fluxo como "Operação". A classificação foi salva certo.
- O erro está na passagem para o Dashboard. O nome "Operação" não existe na tabela de regras do sistema, então a regra cai no tipo bruto "saída". Pela regra padrão, "saída" é Despesa. Por isso aparece o card "SAIDA" de R$ 43.355,22 e o resultado fica negativo em -R$ 26.411,09.
- Vale para qualquer empresa que use "Operação" no Fluxo Bancário, não só Piraquara.

## Correção
- No Dashboard, as operações do banco passam a entrar como "Operações (banco) - entrada" ou "Operações (banco) - saída". Elas mexem só no Caixa e ficam fora de Receita, Despesa e Resultado, assim como já funciona para "Ignorar".
- Em Piraquara/set, o esperado é: o card "SAIDA" some e o Resultado sobe R$ 43.355,22, ficando em +R$ 16.944,13. O Saldo final continua R$ 58.956,85.
- Quando a equipe escolhe "Operação" no Fluxo, essa escolha vale mais que o item do modelo. Exemplo: Pró-Labore está como "entra no resultado" no modelo, mas aqui foi lançado como operação.
- Nada é alterado no banco de dados e nenhum lançamento muda.

## Detalhes técnicos
- `src/lib/bankCashflowOverlay.ts`: novas constantes `OPERACAO_ENTRADA` / `OPERACAO_SAIDA`. Quando `tipo_nome === 'Operação'`, `tipoOriginal` usa uma delas conforme `c.tipo`.
- `src/lib/ledgerEngine.ts` (DEFAULT_MAPPINGS): entradas `operacoes (banco) - entrada|saida` com `impactaCaixa: true` e `entraNoResultado: false`, e sinal somar ou subtrair.
- Teste unitário: uma linha bcf com "Operação" saída resulta em `operacao`, com impacto negativo no saldo e fora do Resultado.
- Verificar na tela o Dashboard de Piraquara em Set/2026.

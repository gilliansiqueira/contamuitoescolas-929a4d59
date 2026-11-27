# Diferença entre Fluxo Diário e Fluxo Bancário — Palmital e Ourinhos

## Objetivo
Descobrir por que o saldo do Fluxo Diário não bate com o do Fluxo Bancário nessas duas empresas e corrigir só o que estiver de fato errado.

## Passos
1. Abrir as duas empresas com um usuário de teste e anotar, no mesmo dia, o saldo do Fluxo Diário e do Fluxo Bancário (por conta e total).
2. Comparar dia a dia até achar a primeira data em que os saldos se separam e listar exatamente as linhas que causam a diferença (duplicadas, faltando, previsão que não foi substituída pelo extrato, aplicação fora da conta, extrato com dia aberto, linha sem classificação).
3. Para cada causa:
   - Erro de dado pontual (linha duplicada/sobra de arquivo antigo): mostrar a lista e corrigir só essas linhas.
   - Erro de regra de cálculo: corrigir no módulo central de cálculo, valendo para todas as empresas, com teste novo.
   - Falta de extrato (ex.: Palmital BB/Bradesco ainda pendentes): informar qual arquivo e qual dia faltam, sem mexer em valores.
4. Conferir de novo na tela das duas empresas e informar o valor final de cada lado e qualquer diferença restante com a origem.

## Regras
- Nenhuma linha é apagada sem origem identificada.
- Nenhum cálculo fora da fonte única de cálculos.
- Usuário de teste removido ao final.

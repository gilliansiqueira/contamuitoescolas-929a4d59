# Fazer todos os números baterem, sem mexer no histórico

## Objetivo
Dashboard e Fluxo Diário de todas as empresas precisam mostrar os mesmos valores de antes, especialmente de junho a agosto de 2026, que estão congelados. Nenhum lançamento salvo será criado, alterado ou apagado. Só o jeito de ler e calcular os números será corrigido.

## O que já sabemos
- O erro de carregamento que pulava lançamentos foi corrigido. Em Santa Mônica, Receita, Despesa, Resultado, Operações e Saldo final de julho e agosto já batem com as suas imagens.
- Ainda falta uma diferença de R$ 3.000 no cartão **Saldo inicial** de julho e de agosto. A causa ainda não foi confirmada. A suspeita é o ajuste feito nas previsões antigas de junho a agosto, que talvez esteja afetando meses que deveriam estar congelados.
- Boa Vista e as outras empresas ainda não foram conferidas.

## Etapas
1. **Descobrir de onde vêm os R$ 3.000 (Santa Mônica).** Seguir o cálculo do Saldo inicial de julho e agosto e achar exatamente qual lançamento ou regra causa a diferença.
2. **Limitar os ajustes do Fluxo de Caixa a setembro/2026 em diante.** Qualquer regra criada para o banco (saldo bancário de 31/08, previsões antigas deixadas de fora, Ignorar no saldo) só pode valer para empresas já ativadas e a partir da competência inicial. Os meses anteriores voltam a ser calculados exatamente como antes.
3. **Montar uma conferência de todas as 55 empresas.** Para cada empresa e cada mês de 2026 até agosto, comparar o que o Dashboard mostra hoje com o cálculo original: Saldo inicial, Receita, Despesa, Resultado, Operações e Saldo final. Listar qualquer diferença com a empresa, o mês e os lançamentos que a causam.
4. **Corrigir o que aparecer** e repetir a conferência até zerar as diferenças.
5. **Conferir na tela** Santa Mônica e Boa Vista com a conta de administradora, comparando com as suas imagens.
6. Mostrar o resultado a você antes de publicar.

## Garantias
- Nenhum registro do banco de dados é alterado. As correções são só no cálculo e na leitura.
- Junho, julho e agosto ficam iguais ao que era antes.
- Os motores oficiais de cálculo não são duplicados nem ganham regras paralelas.

## Detalhes técnicos
- Revisar `bankCashflowOverlay.ts` e a parte de `useFinancialData.ts` que aplica o overlay e define o saldo de abertura. O overlay só pode agir quando `status='ativo'` e para `mês >= start_month`. Na prévia, ele deve atuar apenas dentro da tela de conferência.
- Script de conferência que roda o `projectionEngine`/`ledgerEngine` para cada escola, com e sem o overlay, e compara os resultados mês a mês.
- Adicionar um teste que garanta que meses anteriores a 2026-09 ficam iguais com o overlay ligado e desligado.

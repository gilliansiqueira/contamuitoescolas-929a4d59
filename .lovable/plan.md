# Saldo mais legível em períodos longos

## Objetivo
Transformar o gráfico de saldo do Dashboard em uma leitura adaptativa: detalhado para um único mês e consolidado para períodos com vários meses.

## O que será alterado

- **Um único mês selecionado:** manter a evolução diária atual, pois ela ajuda a identificar datas críticas e necessidades de caixa.
- **Dois ou mais meses selecionados:** substituir os muitos pontos diários por **um ponto de fechamento por mês**.
- No gráfico mensal, mostrar:
  - saldo no início do período;
  - saldo final de cada mês;
  - variação mensal no detalhe ao tocar ou passar o cursor;
  - destaque visual para meses com saldo negativo;
  - resumo com menor fechamento mensal e saldo final do período.
- Usar nomes de mês curtos e legíveis, evitando excesso de datas no eixo.
- No celular, manter o gráfico compacto, com poucos rótulos e toque para consultar cada mês.
- Atualizar o título conforme o contexto: **“Projeção de Saldo Diário”** ou **“Evolução Mensal do Saldo”**.

## Integridade financeira

- Os saldos mensais serão obtidos pelas funções oficiais já usadas no sistema para saldo inicial e saldo final.
- Não haverá nova regra de cálculo nem soma paralela no gráfico.
- Meses históricos, fechados, realizados e projetados respeitarão a fonte oficial definida para cada período.
- Nenhuma outra tela ou dado será alterado.

## Validação

- Conferir um período de um mês e outro de janeiro a agosto.
- Validar que o último ponto mensal coincide exatamente com o cartão de saldo final.
- Validar legibilidade no computador, celular e modo noturno.
- Confirmar destaque de saldo negativo sem prejudicar contraste.

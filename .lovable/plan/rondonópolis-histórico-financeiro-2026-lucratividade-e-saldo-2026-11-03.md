# Rondonópolis: histórico financeiro 2026, lucratividade e saldo inicial

## O que existe hoje
- O saldo inicial (R$ 81.619,16 em 31/08/2026) está só no Fluxo Bancário. O painel não tem histórico mensal antes disso.
- A Análise de Despesas já tem lançamentos realizados de 01/2025 a 10/2026.
- A planilha enviada (Balancete Sponte) cobre 01 a 08/2026: receitas de R$ 3.308.972,03 e despesas de R$ 2.735.055,61, incluindo R$ 426.285,52 de Divisão de Lucros.

## Etapa 1: conferência (antes de gravar qualquer coisa)
- Comparar, mês a mês e categoria por categoria, as despesas da planilha com a Análise de Despesas de 01 a 08/2026.
- Mostrar só as diferenças: categoria, mês, valor na planilha, valor na plataforma e quais lançamentos causam a diferença (falta, duplicado, classificado em outra categoria).
- Você decide caso a caso. Não gravo nada nessa etapa.

## Etapa 2: histórico de 01 a 08/2026
- Gravar receita e despesa por mês a partir da planilha, já com as correções que você aprovar.
- Divisão de Lucros vai separada, como distribuição de lucros: fica fora da despesa, do resultado e da lucratividade, mas reduz o saldo.
- Lucratividade mensal = (receita − despesa sem Divisão de Lucros) ÷ receita.

## Etapa 3: saldo dos meses anteriores (cálculo para trás)
- Partir de R$ 81.619,16 em 31/08/2026 e voltar mês a mês: saldo inicial do mês = saldo final − receitas + despesas + distribuição de lucros.
- Isso gera o saldo inicial de 01/01/2026 e de cada mês. O painel e o Fluxo Bancário passam a usar o mesmo ponto de partida em 31/08.
- Mostro a tabela de saldos para você conferir antes de gravar.

## Etapa 4: 2025 (quando chegar a próxima planilha)
- Mesmo processo para 01 a 12/2025 e continuar o cálculo do saldo para trás até 01/01/2025.

## Detalhes técnicos
- Histórico em `historical_monthly` (tipos `receita`, `despesa`, `distribuicao de lucros`), substituindo apenas 2026-01 a 2026-08 dessa escola. Nada de outros meses ou empresas é alterado.
- A classificação passa pela SSOT (`tipoMeta`/`ledgerEngine`): distribuição como operação, que afeta só o Caixa.
- Conferência final: o painel de 08/2026 deve fechar em R$ 81.619,16, e o resultado de 01–08/2026 deve bater com o "Total Geral" da planilha somado à Divisão de Lucros (R$ 1.000.202,94).

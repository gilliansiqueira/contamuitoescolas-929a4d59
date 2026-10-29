# Conferência: mostrar só pendentes por padrão

## Problema
Na Conferência da Renovação, a lista mostra os itens pendentes junto com os já resolvidos (que aparecem apagados, com o check). Por isso, ao abrir "Sem parcelas do módulo (13)", aparecem os 62 alunos.

## O que muda
- Por padrão, a lista mostra só os pendentes, e o número do botão passa a bater com o que aparece.
- Um botão novo, "Mostrar resolvidos (N)", exibe também os já conferidos/desconsiderados, para revisar ou reabrir.
- "Reabrir todos" só aparece quando os resolvidos estiverem visíveis.

## Detalhes técnicos
- `src/components/renovacao/RenovacaoModule.tsx` (aba Conferência): novo estado `showResolved` (padrão falso); `list` filtra `!i.resolved` quando falso; botão de alternância ao lado dos filtros. Mudança só de tela.

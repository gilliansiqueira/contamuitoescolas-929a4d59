# Justificativas do Ponto mais fáceis de revisar

Hoje as justificativas ficam escondidas na aba "Logins e justificativas", só do mês atual, misturando pendentes, aceitas e recusadas.

## O que muda
1. **Aba própria "Justificativas"** no Ponto, com um número mostrando quantas estão pendentes (ex.: "Justificativas (4)").
2. **Por padrão mostra só as pendentes.** Ao clicar em "Aceitar" ou "Recusar", ela some da lista na hora.
3. **Filtro por pessoa** ("Todas as pessoas" ou uma colaboradora).
4. **Filtro de situação:** Pendentes (padrão) / Aceitas / Recusadas / Todas — para conferir ou desfazer depois.
5. **Mês:** pendentes aparecem de qualquer mês (para nada ficar esquecido); aceitas/recusadas seguem o mês escolhido.
6. Cada linha mostra pessoa, dia, motivo e as batidas daquele dia, para decidir sem trocar de tela.
7. A lista de logins continua na aba atual, sem a parte de justificativas.

## Detalhes técnicos
- `useTeamJustifications`: novo modo que busca todas as `pendente` (sem filtro de mês) + revisadas do mês.
- Novo componente de justificativas em `TeamTimePanel.tsx` com Selects de pessoa/situação; atualização otimista ao revisar.
- Sem mudança no banco nem nas regras de horas.

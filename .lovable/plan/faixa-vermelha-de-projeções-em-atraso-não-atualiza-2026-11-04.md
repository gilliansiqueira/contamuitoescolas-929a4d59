# Faixa vermelha de projeções em atraso não atualiza

## O que está acontecendo
A faixa olha as etapas de projeção do mês **outubro/2026** (porque o prazo das projeções é 30/10), mas a equipe está marcando as projeções no relatório de **novembro/2026** — o mesmo que vence em 06/11 e aparece na Central (Projeção: 7 concluídas). Por isso as entregas nunca diminuem os 63 da faixa.

Além disso, a faixa só se recalcula a cada 5 minutos e não reage quando alguém marca uma etapa.

## O que vou mudar
1. A faixa passa a usar o mês do relatório do aviso (o mês do prazo "texto e relatório", hoje novembro/2026) — o mesmo mês que a Central mostra.
2. Quando uma etapa de projeção for marcada ou desmarcada na plataforma, a faixa se atualiza na hora; também recalcula ao voltar para a aba e a cada 1 minuto.
3. Teste automático: prazo de projeção em 30/10 e relatório em 06/11 → a faixa conta as etapas de novembro; empresa com as três etapas concluídas sai da contagem.

## Detalhes técnicos
- `TeamDeadlineNotice.tsx`: `projMonth` = mês do prazo não-projeção mais tardio do aviso ativo (fallback: mês do prazo de projeção). Extrair para função pura em `src/lib/teamAlerts.ts`.
- `refetchInterval` 60s + `refetchOnWindowFocus`; invalidar `['proj-steps']` onde o checklist mensal é atualizado.

---
name: Histórico - editar/excluir tipos
description: Renomear/excluir conta_nome em realized_entries propagando em todos os lançamentos vinculados
type: feature
---
Componente `TiposHistorico` (Realizado → Configurações → Histórico) lista todos os `conta_nome` distintos com contagem e total. Renomear: UPDATE em massa em realized_entries + chart_of_accounts. Excluir: exige selecionar tipo de destino para reclassificação obrigatória (não permite deixar órfão). Tipos com lançamentos em meses fechados ficam com botões desabilitados e badge "Mês fechado" — o trigger no banco também bloqueia caso alguém tente forçar.

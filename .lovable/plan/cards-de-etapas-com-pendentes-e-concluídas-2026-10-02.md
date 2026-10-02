# Cards de etapas com pendentes e concluídas

## Objetivo
Na Central de Clientes (aba Relatórios), cada card de etapa passa a mostrar quantas empresas estão pendentes e quantas já concluíram aquela etapa, e permite clicar para ver cada grupo na lista.

## O que muda na tela
- Cada card de etapa (Projeção, Análise de despesas, KPIs, Vendas e receitas, Contatos e matrículas, Texto e entrega) mostra dois números: **58 pendentes · 2 concluídas**.
- Ao clicar no card, a lista abaixo filtra as empresas daquela etapa, com uma alternância **Pendentes / Concluídas** para trocar o grupo exibido.
- O card verde **Entregues** continua separado, como está.
- "Outras pendências" não muda.

## Detalhes técnicos
- Arquivo: `src/components/management/ManagementCenter.tsx`.
- Hoje `openGroups` (mapa school_id → etapas abertas) alimenta os cards. Adicionar um mapa `doneGroups` (school_id → etapas concluídas) calculado no mesmo useMemo que gera as etapas do mês.
- Cada card passa a ter estado de alternância (pendentes/concluídas) que ajusta o `match` usado no filtro da lista.
- Sem mudanças no banco, nas RPCs ou nas regras de marcação automática — apenas apresentação.

## Validação
- Conferir na tela que os números batem com a lista filtrada (pendentes + concluídas = empresas com a etapa gerada).
- Verificar que o card Entregues e o filtro de situação continuam funcionando.

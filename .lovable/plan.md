# Ponto da Equipe em tela única (menos abas, menos informação)

## Objetivo
Substituir as 3 abas de conferência do Ponto da Equipe (Dia, Resumo do mês, Extras e faltas) por **uma única tela de conferência**, com filtros de período (hoje, mês, vários meses) e por pessoa. A aba "Logins e justificativas" continua separada, como a Bruna escolheu. A visão das meninas ("Meu ponto") não muda.

## Como vai funcionar a nova tela

```text
┌ Ponto da Equipe (INTerno) ────────────────────────────────────────┐
│ [Hoje] [Este mês] [seus meses...]   [Pessoa: todas ▾]  ⏱ status   │
│                                                                   │
│ [Pendências 7] [Devidas 2:15] [Extras 1:19] [Faltas 2 dias] ...   │  ← cards clicáveis, agora no PERÍODO
│                                                                   │
│ Tabela: 1 linha por pessoa (totals do período)                    │
│   Nome | Extras | Devidas | Faltas | Dias com problema            │
│   ▸ clicar na pessoa → abre os dias dela por baixo                │
│     (batidas em chips, trabalhadas, extras, devidas, situação)    │
│                                                                   │
│ Aba separada: [Logins e justificativas]  (como hoje)              │
└───────────────────────────────────────────────────────────────────┘
```

- **Período:** chips "Hoje" (data escolhida) e "Este mês", + seletor de mês inicial/final para pegar vários meses. Padrão: Hoje.
- **Cards viram totais do período** (ex.: "Horas devidas no período: 2:15"). Clicar filtra a tabela, como já acontece hoje.
- **Tabela agregada:** uma linha por colaboradora com totais do período. No modo "Hoje" a linha já mostra as batidas do dia em chips (igual hoje). Em períodos maiores, clicar na pessoa expande o dia a dia dela.
- **Sai de cena:** as abas "Resumo do mês" e "Extras e faltas", a coluna "Banco de horas" da tabela do dia, e o painel lateral de Alertas (a informação continua: card de pendências + expansão por pessoa).
- **Permanece:** ocultar/restaurar funcionárias (lixeira), filtros de situação e busca por nome (simplificados para: busca + situação), status de sincronização, botão "Atualizar agora", importação de PDF.

## Mudanças técnicas
- `src/hooks/useTeamTime.ts`: `useTeamTime` passa a aceitar intervalo de meses (início–fim); busca `daily`/`occurrences` do intervalo e `hour_bank` de cada competência do intervalo. Mesma RLS, nada de migration.
- `src/components/team/TeamTimePanel.tsx`: reescrito como tela única; nova agregação por pessoa (totais de extras, devidas, faltas, dias com problema) feita com o mesmo `classifyDay` — nenhuma regra duplicada (SSOT do Ponto). A aba "Logins e justificativas" (`AccessAndJustifications`) fica como está.
- Regras de "Em andamento"/dia corrente continuam valendo: o dia atual só conta como falta/extras depois do fechamento, exceto falta com nenhuma batida.
- Dados de exemplo (`buildSampleData`) adaptados ao novo intervalo, para o preview continuar demonstrável.

## O que não muda
- "Meu ponto" das meninas, justificativas delas (motivo, aceitar/recusar), vínculo de login, ocultação de funcionários, integração PontoFopag e importação de relatório.

## Verificação
- Build/typecheck OK; testar na prévia com o acesso de administradora: chips de período, filtro por pessoa, expansão do mês da pessoa, cards com totais e aba de logins intacta.
- Conferir que nenhuma tela antiga (Resumo do mês / Extras e faltas) ainda é referenciada.

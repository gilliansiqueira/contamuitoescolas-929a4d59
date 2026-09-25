# Total de seleção na tela de Conciliação

## Objetivo

Na tela de conciliação do Fluxo Bancário (Operação → Fluxo Bancário → Conciliação), mostrar um total que acompanha as seleções das meninas: conforme elas marcam lançamentos, aparece na hora o valor conciliado e o valor a conciliar.

## O que muda

Somente o componente `src/components/fluxo-bancario/BankTransactionsTable.tsx` (a tabela de conciliação). Nada de banco de dados, cálculos ou histórico — apenas leitura do estado de seleção que já existe.

### Nova barra de totais da seleção

Barra fixa (sticky) logo acima da tabela, visível sempre que houver itens selecionados:

```text
┌──────────────────────────────────────────────────────────────────┐
│ Selecionados: 12 lançamentos · R$ 48.320,50                      │
│   ✓ Conciliados: 7 (R$ 31.400,00)                                │
│   ○ A conciliar: 5 (R$ 16.920,50)                                │
│   ⊘ Não se aplica: 2 (R$ 0,00)  — aparece só quando houver       │
└──────────────────────────────────────────────────────────────────┘
```

- Cores dos rótulos: verde para Conciliados, âmbar para A conciliar, cinza para Não se aplica (paleta existente do projeto, com tokens do tema).
- Atualiza automaticamente a cada clique no checkbox, no "Selecionar todos" e quando a ação em lote limpa a seleção.
- Some quando a seleção fica vazia (a tela volta ao resumo atual de pendentes).

### Resumo existente aprimorado

A linha atual ("X lançamentos · N pendentes (R$ …)") continua e passa a mostrar também o total conciliado e o total de "Não se aplica" do período filtrado, para dar contexto geral:

```text
128 lançamentos · Conciliados 96 (R$ …) · Pendentes 22 (R$ …) · Não se aplica 10 (R$ …)
```

### Detalhes de cálculo (integridade)

- Valores somados direto dos lançamentos já carregados na tela — nenhuma nova consulta, nenhum recálculo financeiro, nada alterado nos dados.
- Lançamento dividido: a barra soma o valor do lançamento original (o valor bancário), igual ao que o botão de conciliar em lote afeta — sem duplicar partes.
- A contagem/valor considera o mesmo conjunto que a ação em lote usa (todos os selecionados, mesmo fora do filtro atual), para nunca divergir do que os botões aplicam.
- Formatação sempre em padrão brasileiro (R$ 1.500,50).

## Verificação

- `tsgo` + build sem erros.
- Abrir a Conciliação de Dourados no preview (sessão de administradora), marcar lançamentos variados (conciliado, pendente, não se aplica, um dividido) e conferir que os totais batem com a soma das linhas e atualizam ao marcar/desmarcar e após "Conciliar selecionados".

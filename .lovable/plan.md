# Nova aba: Detalhamento de Despesas (estrutura livre)

A Análise de Despesas atual não muda em nada. A nova aba é uma área independente, editável a qualquer momento, sem ligação com o plano de contas.

## A estrutura mais simples possível

Só três conceitos:

1. **Nome da aba** (por empresa): ex. "Obras", "Unidades", "Projetos".
2. **Grupos**: ex. Sala, Banheiro, Loja. Criar, renomear, reordenar e remover a qualquer momento.
3. **Itens** dentro de cada grupo: descrição + valor + data. Criar, editar e apagar direto na tela.

Nada mais. Sem categoria mãe, sem categoria filha, sem regras, sem validação de estrutura, sem vínculo com lançamentos existentes.

## Como fica na tela

- A aba aparece só para empresas com a função ligada, com o título configurado (ex. "Obras").
- Mesmo visual da Análise de Despesas: filtro de mês no topo, cartão de total, gráfico de barras por grupo e blocos expansíveis.
- Cada bloco é um grupo, com o total ao lado do nome. Abrindo o bloco, aparecem os itens em lista.
- Tudo é editado no próprio lugar: botão "+ Grupo" no topo, lápis para renomear o grupo, lixeira para remover, arrastar/setas para reordenar, "+ Item" dentro de cada grupo, e clique no item para editar ou apagar.
- Apagar um grupo pergunta uma vez e apaga os itens dele junto.

## Ligar/desligar por empresa

Em Configurações do Relatório Realizado, uma seção "Detalhamento de Despesas": chave liga/desliga e o campo de nome da aba. Desligado, a aba simplesmente não aparece e nada é perdido.

## Detalhes técnicos

Duas tabelas novas, nenhuma alteração em tabelas existentes:

- `expense_detail_groups`: `id`, `school_id`, `name`, `sort_order`, `created_at`.
- `expense_detail_items`: `id`, `school_id`, `group_id` (FK → groups, `ON DELETE CASCADE`), `descricao`, `valor numeric`, `data text` (YYYY-MM-DD), `created_at`.
- RLS por escola nas duas (mesmo padrão das demais tabelas) + GRANTs para `authenticated` e `service_role`.
- Configuração por empresa: colunas novas em `schools` — `expense_detail_enabled boolean default false` e `expense_detail_label text default 'Detalhamento'` (aditivo, com default; evita uma terceira tabela).

Frontend:
- `src/components/realizado/DetalhamentoDespesas.tsx`: a aba inteira (filtro de mês via `SharedMonthContext`/`GlobalPeriod`, total, gráfico de barras Recharts nos mesmos moldes, blocos de grupo com edição inline). Um único arquivo, sem tocar em `RelatorioRealizado.tsx`.
- `src/hooks/useExpenseDetail.ts`: queries e mutations dos grupos/itens + config da escola.
- `RealizadoModule.tsx`: nova view `detalhamento` em `MainView`/`TabVisibility`, botão com o rótulo configurado, envolvida em `ExportPdfSection`; e a seção de configuração (liga/desliga + nome) dentro das Configurações.

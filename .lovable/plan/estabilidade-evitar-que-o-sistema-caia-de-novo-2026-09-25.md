# Estabilidade: evitar que o sistema caia de novo

## O que já foi feito e o que ainda falta
Já foi feito: índices nos lançamentos da Projeção, busca em partes mais leve e menos colunas carregadas.

O que ainda falta, e provavelmente derrubou o servidor hoje:
- A tabela do **Relatório Realizado** (cerca de 115 mil linhas) não tem o índice que a nova busca em partes usa. Cada parte obriga o servidor a ler todas as linhas da empresa. Essa busca roda em cerca de 10 telas (Realizado, Teto de Gastos, Comparativo, PDFs, Histórico de Uploads, Fechamento, Exportação...).
- As tabelas do Fluxo Bancário, agora ligado em todas as 55 empresas, também não têm esse índice.
- Cada tela busca os lançamentos inteiros de novo, mesmo quando outra tela já tinha buscado. Com várias meninas trocando de empresa ao mesmo tempo, os pedidos se acumulam até o servidor travar.
- A regra de acesso de cada linha (quem pode ver qual empresa) pode estar pesando. Isso ainda não foi confirmado e vai ser medido.

## O que vou fazer
1. **Índices que faltam** (Realizado, Fluxo Bancário, lançamentos do caixa): cada parte da busca passa a ser imediata. Isso não mexe em nenhum dado.
2. **Uma busca por empresa, compartilhada entre as telas:** Realizado, Teto, Comparativo, PDFs etc. passam a usar a mesma busca guardada em memória, em vez de cada uma buscar tudo de novo. Ela só é refeita depois de uma importação, edição ou exclusão.
3. **Menos pedidos simultâneos:** trocar de empresa várias vezes seguidas cancela as buscas anteriores, em vez de empilhar pedidos.
4. **Medir a regra de acesso:** comparar o tempo de uma busca real com e sem a regra. Se ela pesar, reescrever a verificação em formato mais rápido, mantendo exatamente as mesmas permissões.
5. **Conferir antes e depois:** tempo das buscas mais lentas, carregamento do Dashboard de Santa Mônica e de Boa Vista, e números de julho, agosto e setembro iguais aos de hoje.
6. **Tamanho do servidor:** depois das correções, olhar memória e conexões. Se continuarem no limite em horário de pico, recomendo aumentar o servidor, mas só com a sua aprovação, porque tem custo.

## Garantias
- Nenhum lançamento é criado, alterado ou apagado. O histórico fica intacto.
- Os cálculos oficiais não mudam, só a forma de buscar os dados.

## Detalhes técnicos
- Migration: `CREATE INDEX IF NOT EXISTS` em realized_entries(school_id,id), bank_transactions(school_id,id), bank_cashflow_entries(school_id,id), bank_transaction_splits(school_id,id), chart_of_accounts(school_id,id).
- Novo hook `useRealizedEntries(schoolId)` (react-query, staleTime 5 min, queryKey ['realized_entries', schoolId]) para substituir os ~10 fetchAllRows diretos. Invalidação nas importações/edições/exclusões existentes.
- AbortSignal em fetchAllRows (queryFn signal) para cancelar paginação obsoleta.
- EXPLAIN ANALYZE com o papel authenticated para medir o custo da RLS. Se necessário, usar funções `security definer stable` envolvidas em `(select ...)`.
- `pg_stat_statements` antes/depois; `db_health` para decidir sobre resize.

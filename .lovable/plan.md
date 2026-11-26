# Importar os dados da Srta Lolli

## O que chegou
O arquivo traz 33 tabelas: 16.209 vendas, 2.054 despesas, 1.764 lançamentos de fluxo de caixa, 1.311 taxas de gateway, 599 movimentos de banco (3 contas, 13 saldos), 1.701 produtos, 134 devoluções, 226 pedidos ignorados do Olist, 86 grupos de despesa, 128 taxas de cartão manuais, mais fretes, impostos, receitas manuais e marketing (poucas linhas). Folha, chargebacks, custos de produto, regras de fluxo e modelos de importação vieram vazios.

## O que vou fazer
1. **Estrutura:** criar aqui as tabelas próprias da Lolli (vendas, devoluções, pedidos ignorados, produtos, taxas de gateway e por período, taxas/fretes/impostos/receitas manuais, marketing, grupos de despesa, despesas e fluxo de caixa do Tiny), todas ligadas à empresa Srta Lolli e visíveis só para a equipe com acesso a ela.
2. **Banco:** as 3 contas, os saldos e os 599 movimentos entram no Fluxo Bancário que já existe aqui, mantendo o status de conciliação e as observações.
3. **Importação:** carregar todas as linhas, cada uma marcada com o arquivo de origem ("export Srta Lolli 26/11/2026"), para dar para desfazer tudo de uma vez se precisar.
4. **Conferência:** comparar com o projeto antigo, mês a mês, quantidade e total de vendas, devoluções, despesas, taxas e saldo de banco. Mostro qualquer diferença com as linhas que causam ela.
5. **Telas:** em seguida, as telas exclusivas da Lolli (Dashboard, Resumo, DRE, Fretes, Marketing, Produtos), abertas só quando a empresa selecionada for a Lolli.

## O que fica de fora
- **Chaves do Tiny:** não importo. A conta Olist/Tiny é reconectada uma vez aqui, por segurança.
- **Histórico de sincronizações (70.699 linhas) e lista de importações antigas:** só registro técnico. Guardo apenas a data da última sincronização.
- **Usuários e permissões do projeto antigo:** os acessos já são feitos aqui, pela carteira da Ana.
- Nenhum dado do projeto antigo é apagado, e nada muda nas outras empresas.

## Detalhes técnicos
- Empresa destino: `schools.id = 11f200c9-…` (company_id antigo `418b41a4-…` mapeado para ela).
- Tabelas `lolli_*` com `school_id`, GRANTs, RLS `is_admin() AND user_has_school_access` + RESTRICTIVE `can_see_school`; preservam ids originais e `import_ref`.
- Banco: `bank_accounts`/`bank_balances`/`bank_transactions` com `source_kind='lolli_export'`; status mapeados (conciliado/pendente) sem passar pela conciliação automática.
- Despesas/fluxo da Lolli ficam isolados (não entram no motor financeiro das outras empresas); a regra fica registrada no AGENTS.md seguindo o padrão `isQuintal()` → `isLolli()`.
- Carga via `supabase--run_sql` em lotes, conferência por SQL comparando com as somas dos CSVs.

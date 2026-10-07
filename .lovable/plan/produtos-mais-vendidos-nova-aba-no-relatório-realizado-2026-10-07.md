# Produtos mais vendidos — nova aba no Relatório Realizado

## O que é
Clientes que vendem produtos (Jurassic, Farmácia Magistral, Contorno, WNC) pedem o relatório "Mais vendidos" que hoje é feito no Canva: ranking de produtos por valor e por quantidade, com comparação entre meses. Vira uma aba nova dentro do Relatório Realizado, ativada por empresa.

## Entrada de dados
- **Colar de planilha** (mesmo padrão do Plano de Contas): a pessoa cola linhas com `Produto | Valor | Quantidade` para o mês escolhido.
- Conferência antes de gravar: mostra quantos produtos foram lidos, total em valor e total em quantidade; só grava após confirmar.
- Reenviar o mesmo mês **substitui** os dados daquele mês (nunca duplica).
- Valores aceitos no formato brasileiro (1.500,50).

## Aba "Produtos mais vendidos" (Relatório Realizado)
- Aba modular nova, ativada por empresa em `module_tabs` (liga para Jurassic, Farmácia Magistral, Contorno e WNC na implantação).
- **Visão padrão:** mês selecionado com o mês anterior ao lado — tabela com ranking por valor e por quantidade (produto, valor, qtd, % do total), como no PDF do Canva.
- **Filtros:** período livre (mês inicial/final) e produto específico.
- **Gráfico de linha:** ao filtrar vários meses e um produto, mostra a evolução (valor e quantidade mês a mês) para ver se está subindo ou caindo.
- Somente consulta para cliente; equipe (admin) cola/edita os dados.

## Banco de dados (migração)
- Tabela `product_sales_monthly`: `school_id`, `month` (AAAA-MM), `produto`, `valor`, `quantidade`, `created_at`.
- RLS: leitura para quem tem acesso à empresa (`user_has_school_access`), escrita para admin/super_admin; política RESTRICTIVE `can_see_school` (padrão das tabelas com `school_id`).
- Único por (`school_id`, `month`, `produto`) para substituição sem duplicar.

## Arquivos
- Migração nova (tabela + RLS + grants).
- `src/components/realizado/ProdutosMaisVendidos.tsx` (aba: tabela comparativa, filtros, gráfico de linha, colar de planilha).
- `src/hooks/useProductSales.ts` (busca/gravação).
- `src/components/realizado/RealizadoModule.tsx` (registrar a aba modular).

## Fora de escopo
- Não entra em nenhum cálculo financeiro (Receita/Resultado/Caixa) — é análise gerencial separada, sem vínculo com a SSOT.
- Sem importação automática de sistema de vendas; entrada é só colar de planilha.

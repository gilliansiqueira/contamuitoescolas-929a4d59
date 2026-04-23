---
name: Análise de Vendas (MVP)
description: Aba do Relatório Realizado para análise de pedidos com cards dinâmicos, filtros e cadastros (produtos/canais/formas), independente da aba Vendas
type: feature
---
**Localização**: Aba "Análise de Vendas" dentro de Relatório Realizado, junto a Despesas/Indicadores/Conversão/Vendas. Modular (registro `module_tabs.tab_key='analise_vendas'`). Totalmente independente da aba "Vendas" (que controla forma de pagamento + bandeiras).

**Tabelas próprias** (todas isoladas por `school_id`, RLS = admin OR current_user_school_id):
- `sales_analysis_products` (catálogo com `default_cost`)
- `sales_analysis_channels` (canais de venda)
- `sales_analysis_payment_methods` (formas, **separadas** das de `sales_payment_methods`)
- `sales_analysis_orders` (pedido: `order_date`, `gross_value`, `cost_total`, `fees`, `shipping`, `shipping_paid_by_customer`, `status` ∈ concluido/cancelado/pendente, `channel_id`, `payment_method_id`)
- `sales_analysis_order_items` (itens: `product_id`, `product_name` snapshot, `quantity`, `unit_price`, `unit_cost`)

**Cálculos**:
- Faturamento bruto = Σ `gross_value` (excl. cancelados)
- Lucro bruto = bruto − custo − taxas − frete (frete só se NÃO pago pelo cliente)
- Faturamento líquido = lucro bruto
- Ticket médio = líquido / qtd pedidos
- Margem bruta = (lucro / bruto) × 100
- Produto mais vendido = max(Σ qty); mais lucrativo = max(Σ (price−cost)×qty)

**Cards dinâmicos**: visibilidade salva em `localStorage` (`sa_card_visibility_${schoolId}`). Cards que dependem de custo/canal/forma são automaticamente ocultados quando os dados não existem. Toggle manual via Popover "Cards".

**Filtros do dashboard**: data inicial/final, canal, forma. Aplicam-se aos cards E à tabela de pedidos.

**Edição**: PedidoDialog permite criar/editar pedido com múltiplos itens (selecionar produto cadastrado preenche custo unit. automaticamente, ou texto livre). Excluir via AlertDialog de confirmação. Frete tem checkbox "pago pelo cliente" (não entra no custo se true).

**Pendente (Fase 2)**: importação de planilha, gráficos (linha temporal, comparação por ano, ranking, distribuição por canal), galeria de ícones personalizados.

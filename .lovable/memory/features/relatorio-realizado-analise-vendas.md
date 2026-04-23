---
name: Análise de Vendas (importação + galeria de ícones)
description: Aba do Relatório Realizado para análise de pedidos com cards dinâmicos, filtros, cadastros (produtos/canais/formas), importação de planilha e galeria de ícones reutilizáveis (globais + por escola)
type: feature
---
**Localização**: Aba "Análise de Vendas" dentro de Relatório Realizado, junto a Despesas/Indicadores/Conversão/Vendas. Modular (registro `module_tabs.tab_key='analise_vendas'`). Totalmente independente da aba "Vendas" (que controla forma de pagamento + bandeiras).

**Tabelas próprias** (todas isoladas por `school_id`, RLS = admin OR current_user_school_id):
- `sales_analysis_products` (catálogo com `default_cost` e `icon_url` para ícone customizado)
- `sales_analysis_channels` (canais de venda)
- `sales_analysis_payment_methods` (formas, **separadas** das de `sales_payment_methods`)
- `sales_analysis_orders` (pedido: `order_date`, `gross_value`, `cost_total`, `fees`, `shipping`, `shipping_paid_by_customer`, `status` ∈ concluido/cancelado/pendente, `channel_id`, `payment_method_id`)
- `sales_analysis_order_items` (itens: `product_id`, `product_name` snapshot, `quantity`, `unit_price`, `unit_cost`)
- `sa_icons` (galeria de ícones: `name`, `file_url`, `is_global`, `school_id`). Globais visíveis a todas as escolas; CRUD global é restrito a admin via RLS. Arquivos em bucket público `kpi-icons` (path `sa-icons/{global|schoolId}/{uuid}.{ext}`).

**Cálculos**:
- Faturamento bruto = Σ `gross_value` (excl. cancelados)
- Lucro bruto = bruto − custo − taxas − frete (frete só se NÃO pago pelo cliente)
- Faturamento líquido = lucro bruto
- Ticket médio = líquido / qtd pedidos
- Margem bruta = (lucro / bruto) × 100
- Produto mais vendido = max(Σ qty); mais lucrativo = max(Σ (price−cost)×qty)

**Cards dinâmicos**: visibilidade salva em `localStorage` (`sa_card_visibility_${schoolId}`). Cards que dependem de custo/canal/forma são automaticamente ocultados quando os dados não existem. Toggle manual via Popover "Cards". Cards de "produto mais vendido/lucrativo" exibem `icon_url` do produto cadastrado quando disponível.

**Filtros do dashboard**: data inicial/final, canal, forma. Aplicam-se aos cards E à tabela de pedidos.

**Edição**: PedidoDialog permite criar/editar pedido com múltiplos itens (selecionar produto cadastrado preenche custo unit. automaticamente, ou texto livre). Excluir via AlertDialog de confirmação. Frete tem checkbox "pago pelo cliente" (não entra no custo se true).

**Importação de planilha** (`Cadastros → Importação`): upload `.xlsx/.csv` em 3 etapas (upload → mapeamento → preview). Auto-sugere colunas por aliases. Cria automaticamente produtos/canais/formas que não existirem. Botão "Baixar modelo" gera template. Frete é considerado "pago pelo cliente" quando 0; valor unitário é derivado de total/qtd quando ausente.

**Galeria de ícones** (`Cadastros → Ícones`): upload PNG/JPG/SVG/WEBP/GIF até 1MB. Admin pode marcar como "global" (reutilizável por todas as empresas). `IconPicker` (popover) seleciona ícone para o produto direto na lista de Produtos.

**Pendente (Fase 3)**: gráficos (linha temporal, comparação por ano, ranking, distribuição por canal).

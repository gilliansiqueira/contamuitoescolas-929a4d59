/** Exclusive Lolli data; never feeds the other companies' financial engines. */
export const LOLLI_SCHOOL_ID = '11f200c9-e1ae-4336-8b2b-75e44eafd8dc';
export const isLolli = (schoolId?: string | null) => schoolId === LOLLI_SCHOOL_ID;

export function lolliMatchesPeriod(date: unknown, months: readonly string[]): boolean {
  if (!months.length) return true;
  return typeof date === 'string' && months.includes(date.slice(0, 7));
}

export type LolliColumn = { key: string; label: string; money?: boolean; date?: boolean };
export type LolliDataset = { key: string; label: string; date?: string; columns: LolliColumn[] };
export const lolliDatasets: LolliDataset[] = [
  { key: 'sales', label: 'Resumo de vendas', date: 'data_venda', columns: [
    { key: 'data_venda', label: 'Data', date: true }, { key: 'external_id', label: 'Pedido / item' },
    { key: 'cliente', label: 'Cliente' }, { key: 'produto', label: 'Produto' }, { key: 'canal', label: 'Canal' },
    { key: 'quantidade', label: 'Quantidade' }, { key: 'valor_bruto', label: 'Bruto', money: true },
    { key: 'desconto', label: 'Desconto', money: true }, { key: 'valor_liquido', label: 'Líquido', money: true },
    { key: 'status', label: 'Situação' },
  ] },
  { key: 'expenses', label: 'Despesas', date: 'data_despesa', columns: [
    { key: 'data_despesa', label: 'Data', date: true }, { key: 'descricao', label: 'Fornecedor / descrição' },
    { key: 'categoria', label: 'Categoria' }, { key: 'valor', label: 'Valor', money: true },
  ] },
  { key: 'cash_flow_entries', label: 'Caixa Olist', date: 'data_lancamento', columns: [
    { key: 'data_lancamento', label: 'Data', date: true }, { key: 'descricao', label: 'Descrição' },
    { key: 'fornecedor_cliente', label: 'Fornecedor / cliente' }, { key: 'tipo', label: 'Movimento' },
    { key: 'categoria_olist', label: 'Categoria' }, { key: 'conta_olist', label: 'Conta' },
    { key: 'valor', label: 'Valor', money: true }, { key: 'status', label: 'Situação' },
  ] },
  { key: 'gateway_fees', label: 'Taxas', date: 'data_transacao', columns: [
    { key: 'data_transacao', label: 'Data', date: true }, { key: 'gateway', label: 'Gateway' },
    { key: 'bandeira', label: 'Bandeira' }, { key: 'tipo_transacao', label: 'Transação' },
    { key: 'valor_bruto', label: 'Bruto', money: true }, { key: 'valor_taxa', label: 'Taxa', money: true },
    { key: 'valor_liquido', label: 'Líquido', money: true },
  ] },
  { key: 'card_fees_manuais', label: 'Taxas de cartão', date: 'data', columns: [
    { key: 'data', label: 'Data', date: true }, { key: 'taxa_credito', label: 'Crédito', money: true },
    { key: 'taxa_debito', label: 'Débito', money: true }, { key: 'observacao', label: 'Observação' },
  ] },
  { key: 'devolucoes_venda', label: 'Devoluções', date: 'data_devolucao', columns: [
    { key: 'data_devolucao', label: 'Data', date: true }, { key: 'numero_nota', label: 'Nota' },
    { key: 'cliente', label: 'Cliente' }, { key: 'valor', label: 'Valor', money: true },
    { key: 'valor_frete', label: 'Frete', money: true }, { key: 'observacoes', label: 'Observação' },
  ] },
  { key: 'fretes_manuais', label: 'Fretes', date: 'mes', columns: [
    { key: 'mes', label: 'Mês', date: true }, { key: 'valor', label: 'Valor', money: true },
    { key: 'observacao', label: 'Observação' },
  ] },
  { key: 'marketing_spend', label: 'Marketing', date: 'data_mkt', columns: [
    { key: 'data_mkt', label: 'Data', date: true }, { key: 'plataforma', label: 'Plataforma' },
    { key: 'campanha', label: 'Campanha' }, { key: 'investimento', label: 'Investimento', money: true },
    { key: 'receita_atribuida', label: 'Receita atribuída', money: true }, { key: 'compras', label: 'Compras' },
  ] },
  { key: 'products', label: 'Produtos', columns: [
    { key: 'sku', label: 'SKU' }, { key: 'nome', label: 'Produto' },
    { key: 'preco_lista', label: 'Preço de lista', money: true },
  ] },
  { key: 'expense_category_groups', label: 'Grupos de despesas', columns: [
    { key: 'categoria', label: 'Categoria' }, { key: 'grupo', label: 'Grupo' },
  ] },
  { key: 'manual_revenues', label: 'Receitas manuais', date: 'data', columns: [
    { key: 'data', label: 'Data', date: true }, { key: 'canal', label: 'Canal' },
    { key: 'vendedor', label: 'Vendedor' }, { key: 'valor', label: 'Valor', money: true },
    { key: 'observacao', label: 'Observação' },
  ] },
  { key: 'impostos_manuais', label: 'Impostos', date: 'mes', columns: [
    { key: 'mes', label: 'Mês', date: true }, { key: 'valor', label: 'Valor', money: true },
    { key: 'observacao', label: 'Observação' },
  ] },
  { key: 'gateway_fee_periods', label: 'Cobertura de taxas', date: 'ano_mes', columns: [
    { key: 'ano_mes', label: 'Mês' }, { key: 'gateway', label: 'Gateway' },
    { key: 'qtd_transacoes', label: 'Transações' }, { key: 'total_bruto', label: 'Bruto', money: true },
    { key: 'total_taxas', label: 'Taxas', money: true }, { key: 'total_liquido', label: 'Líquido', money: true },
  ] },
  { key: 'olist_ignored_pedidos', label: 'Pedidos ignorados', columns: [
    { key: 'olist_pedido_id', label: 'Pedido Olist' }, { key: 'motivo', label: 'Motivo' },
    { key: 'created_at', label: 'Registrado em', date: true },
  ] },
];
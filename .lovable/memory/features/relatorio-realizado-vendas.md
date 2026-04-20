---
name: Aba Vendas
description: Aba opcional do Relatório Realizado para receitas por forma de pagamento e bandeiras de cartão (crédito + débito), com bandeiras compartilhadas entre escolas
type: feature
---
A aba **Vendas** está dentro do módulo Relatório Realizado (junto com Análise de Despesas, Indicadores e Conversão). Ativada por padrão, pode ser desligada em Configurações → Abas (registro em `module_tabs` com `tab_key='vendas'`). Desativar não apaga dados.

Tabelas: `sales_payment_methods` (formas ativas por escola), `sales_card_brands` (bandeiras + ícones — **globais/compartilhadas entre todas as escolas**, `school_id` é nullable e novas bandeiras são criadas com `school_id=null`), `sales_data` (valores mensais por método/bandeira/mês, por escola). Ícones em bucket `card-brand-icons` salvos em path `global/`.

Formas padrão semeadas na primeira visita: Cartão de crédito, Cartão de débito, Pix, Boleto, Cheque, Dinheiro. Detalhamento por bandeira (Visa, Mastercard, Elo, Amex...) está disponível tanto para **Crédito quanto Débito** (`METHODS_WITH_BRANDS = {'credito','debito'}`). Bandeiras são geridas em `sales_card_brands` e ativadas via `sales_payment_methods` com `method_key='brand-<id>'` (toggle único — quando ativa, aparece automaticamente nas linhas de Crédito **e** Débito na tabela). A seção "Bandeiras de Cartão" em VendasConfig só aparece quando Crédito OU Débito está ativo.

Edição manual nos cards: formas sem bandeira (Pix, Boleto, Cheque, Dinheiro) mostram input direto no card que substitui valores prévios por uma única entrada no mês corrente. Para Crédito/Débito, a tabela gera dinamicamente uma linha por bandeira ativa (rotuladas "Crédito · Visa", "Débito · Visa"...) + linha "Sem bandeira" para legado. Ícones renderizam com fallback de iniciais (2 letras) quando `icon_url` está vazio ou falha ao carregar.

Visualização: total geral, cards por forma com inputs inline, **grid de cards por bandeira** (soma crédito+débito, com ícone/fallback de iniciais), gráfico pizza por forma, tabela editável anos × meses (filtrável por forma e bandeira para crédito/débito).

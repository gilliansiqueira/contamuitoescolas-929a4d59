---
name: Aba Vendas
description: Aba opcional do Relatório Realizado para receitas por forma de pagamento e bandeiras de cartão
type: feature
---
A aba **Vendas** está dentro do módulo Relatório Realizado (junto com Análise de Despesas, Indicadores e Conversão). Ativada por padrão, pode ser desligada em Configurações → Abas (registro em `module_tabs` com `tab_key='vendas'`). Desativar não apaga dados.

Tabelas: `sales_payment_methods` (formas ativas por escola), `sales_card_brands` (bandeiras + ícones em bucket `card-brand-icons`), `sales_data` (valores mensais por método/bandeira/mês).

Formas padrão semeadas na primeira visita: Cartão de crédito, Cartão de débito, Pix, Boleto, Cheque, Dinheiro. Detalhamento por bandeira (Visa, Mastercard, Elo, Amex...) é exclusivo do Crédito; cada bandeira aceita upload de logo.

Visualização: total geral, cards por forma (com sub-lista de bandeiras no Crédito), gráfico pizza por forma, gráfico de barras por bandeira, tabela editável anos × meses (filtrável por forma e bandeira).

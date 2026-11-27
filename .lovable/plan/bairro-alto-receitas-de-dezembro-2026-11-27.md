# Bairro Alto — receitas de dezembro

Não precisa mudar nada. A planilha foi lida inteira, e o prazo de 30 dias do cartão de crédito, que você confirmou, leva R$ 54.448,73 de dezembro para janeiro. O prazo de 2 dias do boleto também passa R$ 8.578,00 para janeiro.

Dezembro na plataforma fica em cerca de R$ 50,5 mil (Sponte R$ 46.619,54 + cheques R$ 3.932,00). Esse é o valor que deve entrar no banco, e não o valor que vence no mês.

## Detalhes técnicos
- Prazos em `payment_delay_rules` (crédito 30, boleto 2, débito 2, PIX 0).
- `financial_entries` guarda o vencimento em `data_original` e a entrada prevista no banco em `data`.

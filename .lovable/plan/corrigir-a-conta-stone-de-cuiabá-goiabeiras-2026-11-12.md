# Corrigir a conta Stone de Cuiabá Goiabeiras

## O que o extrato mostra
- O arquivo é da Stone, agência 1, conta **5416354-8**.
- Os lançamentos batem com os de Goiabeiras já gravados (por exemplo, R$ 1.684,25 em 30 e 31/10). Então é mesmo a conta de Goiabeiras.
- Hoje o cadastro de Goiabeiras está com 4373635, que é o número de Jardim Itália.

## O que vou fazer
1. Trocar o número da Stone de Goiabeiras para 5416354-8. Lançamentos, saldos e conciliações não mudam.
2. Não mexer em Jardim Itália: ela continua com 4373635 e segue aceitando os extratos dela.
3. Depois disso, é só enviar de novo este mesmo arquivo pela tela de Contas e Extratos de Goiabeiras.

## Detalhes técnicos
- run_sql: `update bank_accounts set conta='5416354-8' where id='6bfc91b1-37a2-458d-9784-f7da19db445f'`, e depois conferir o valor gravado.

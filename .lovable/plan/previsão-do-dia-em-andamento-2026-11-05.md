# Previsão do dia em andamento

- Manter o saldo realizado separado do saldo projetado: receber ou pagar uma parte do dia não significa que o dia inteiro terminou.
- No dia atual, somar ao realizado o que ainda falta da previsão de entradas e de saídas, abatendo cada sentido separadamente para não duplicar valores já realizados. Operações continuam separadas do resultado.
- Aplicar a mesma regra no Fluxo Diário, fechamento mensal e avisos de saldo, sem alterar meses encerrados ou dados gravados.
- Ajustar o aviso de corte para mostrar que hoje ainda inclui previsão pendente.
- Conferir com testes o exemplo do Champagnat: R$ 35.420,14 realizados, R$ 978,54 previstos de entrada (R$ 408,10 recebidos) e R$ 30.116,48 previstos de saída; saldo projetado do dia de R$ 5.874,10.

## Detalhes técnicos
- Regra pura compartilhada na camada financeira oficial; nenhuma fórmula nova nas telas.
- Cobertura de pagamento parcial, previsão já realizada, operações, dias passados e consistência entre fechamento mensal e diário.
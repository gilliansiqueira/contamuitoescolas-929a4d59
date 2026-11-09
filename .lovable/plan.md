# Lucratividade de São Carlos (automática e meses anteriores corrigidos)

## O que encontrei
- Os dois indicadores de São Carlos ("Lucratividade" e "Lucratividade Operacional ") não estão ligados à regra automática. Todos os valores, de jan/2025 a out/2026, foram digitados à mão.
- Outubro/2026 tem só a total (3,86%) e falta a operacional.
- Há meses com valores incoerentes, por exemplo em out/2025 a total aparece em 26,49% e a operacional em 1,94%. A total só fica maior que a operacional se as operações tiverem entrado dinheiro, o que precisa ser confirmado.
- Nenhum mês de São Carlos está fechado.

## O que vou fazer
1. Renomear para o padrão das outras escolas: "Lucratividade" vira "Lucratividade total" e "Lucratividade Operacional " vira "Lucratividade operacional". Os dois passam a usar a regra automática do Dashboard, que já deixa aplicações e resgates de fora.
2. Calcular, com a mesma regra do Dashboard, as duas lucratividades de cada mês com dados, de jan/2025 a out/2026.
3. Trocar os valores salvos pelos calculados (como você pediu) e te mostrar uma tabela com o mês, o valor antigo e o novo, para você ver o que mudou.
4. Meses sem movimento na plataforma continuam com o valor que já está salvo. Eles não são apagados, e eu aviso quais são.
5. De outubro em diante, o valor se atualiza sozinho, igual SJP e Portão.

## Detalhes técnicos
- `kpi_definitions`: preencher `auto_key` com `lucro_total` e `lucro_operacional` e ajustar `name`.
- Os valores históricos são calculados com `buildMonthMovement` e `computeProfitability`, num script feito uma vez só que usa os mesmos módulos e os mesmos dados do Dashboard. A gravação em `kpi_values` é feita por upsert por mês, com antes e depois registrados.
- O hook automático (a partir de out/2026) não muda.

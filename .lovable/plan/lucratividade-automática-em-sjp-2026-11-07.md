# Lucratividade automática em SJP

## O que encontrei
SJP tem dois indicadores digitados à mão, sem ligação com o cálculo automático, por isso outubro/2026 ficou vazio:
- "Lucratividade (Sem Pró-Labore)": últimos valores jun–set/2026 = 33,66% / 44,41% / 38,20% / 24,17%
- "Lucratividade (Com Pró-Labore)": jun–set/2026 = 19,70% / 31,75% / 25,89% / 8,77%

## O que vou fazer (igual ao feito em Portão)
1. Renomear "Sem Pró-Labore" para **Lucratividade operacional** (sem Operações) e ligar à regra automática.
2. Renomear "Com Pró-Labore" para **Lucratividade total** (com Operações, onde fica o pró-labore) e ligar à regra automática.
3. Manter todos os valores históricos digitados (até setembro).
4. Preencher outubro/2026 com a mesma regra do Dashboard e mostrar os números para conferência antes do envio ao cliente.

## Detalhes técnicos
- `kpi_definitions` 501b01d8… → name 'Lucratividade operacional', auto_key 'lucro_operacional'; 912980a1… → 'Lucratividade total', auto_key 'lucro_total'.
- Outubro calculado via `useAutoProfitability` (abrindo Indicadores de SJP) ou gravado com o mesmo cálculo de `profitability.ts`; meses fechados não são sobrescritos.

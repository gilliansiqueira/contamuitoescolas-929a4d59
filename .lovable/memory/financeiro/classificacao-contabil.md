---
name: Classificação Contábil
description: Modelo do usuário (Classificação + Sinal obrigatório). Sem heurísticas/sinônimos por nome
type: feature
---

A classificação contábil ('receita', 'despesa', 'operacao', 'ignorar') é decidida **pelo usuário** na tabela `type_classifications` e é a única fonte de verdade para todos os cálculos.

## Modelo
Toda configuração de tipo tem **dois campos obrigatórios** (exceto `ignorar`):
1. **Classificação**: `receita | despesa | operacao | ignorar`
2. **Sinal no caixa**: `somar (+) | subtrair (−)`

## Regras de comportamento
- **Receita** → entra no resultado (+) · saldo: respeita o sinal
- **Despesa** → entra no resultado (−) · saldo: respeita o sinal
- **Operação** → NÃO entra no resultado · saldo: respeita o sinal
- **Ignorar** → não entra em resultado, saldo, gráficos ou cálculos

## Sugestões automáticas na UI (apenas defaults)
- Receita → sugere `Somar (+)`
- Despesa → sugere `Subtrair (−)`
- Operação → sugere `Somar (+)` (usuário escolhe livremente)
- Ignorar → desabilita o sinal

## Resolução da classificação efetiva (sem heurística por nome)
1. Se há config em `type_classifications` da empresa (lookup pela chave normalizada) → usa a config
2. Sem config → fallback pelo `entry.tipo` (entrada=receita, saida=despesa)

> A flag `editadoManualmente` é **apenas um marcador de auditoria** (indica que o lançamento foi ajustado manualmente na tela de Dados). Ela **não influencia** a resolução da classificação contábil.

> Origens `sponte`, `cheque`, `cartao` e `contas_pagar` sempre usam o tipo nativo (`entry.tipo`), sem passar pela configuração de `type_classifications`.

> A normalização (`normalizeTipo`) só remove acento/case/espaços para casar variações de escrita do **mesmo nome**. Não há mais mapa de sinônimos (`saida → despesa`, etc.) — a configuração do usuário manda.

## Cálculo final
- `resultado = receitas - despesas`
- `saldo = saldoInicial + Σ getSaldoImpact(entry)` (ignora `ignorar`)

## Imutabilidade de meses fechados
Triggers em `historical_monthly`, `financial_entries`, `sales_data` e `conversion_data` bloqueiam UPDATE/DELETE em meses fechados. Mudanças em `type_classifications` não fazem UPDATE em entries — afetam apenas a leitura/processamento de meses ainda abertos.

---
name: Classificação Contábil
description: Hierarquia de tipagem (Tabela > Texto > Sinal), normalização canônica única (sem acentos) e mapa de sinônimos para evitar duplicação
type: feature
---

A classificação contábil ('receita', 'despesa', 'operacao', 'ignorar') é a única fonte de verdade para todos os cálculos de KPIs, fluxo, dashboard e relatórios.

## Normalização canônica (OBRIGATÓRIA)
Use **sempre** `normalizeTipo(s)` de `src/lib/classificationUtils.ts` antes de comparar/agrupar tipos. A função:
- converte para lowercase
- remove acentos (NFD)
- faz trim e colapsa espaços internos

Exemplos: `"Saída "`, `"saida"`, `"SAÍDA"` → `"saida"`.

## Mapa de sinônimos (fixo)
Aplicado antes de qualquer lookup em `type_classifications`:
- `receita`, `receitas`, `entrada`, `entradas` → **receita**
- `despesa`, `despesas`, `saida`, `saidas` → **despesa**

## Hierarquia de resolução
1. **Sinônimo canônico** (mapa fixo acima)
2. **`type_classifications`** da escola (lookup por chave normalizada)
3. **Heurística pelo `tipo`** do entry (entrada/saida) ou sinal do valor

## Regras
- Override manual (`editadoManualmente=true`) tem prioridade absoluta.
- Operacao respeita `operacaoSinal` ('auto'|'somar'|'subtrair') no impacto de saldo.
- Ignorar: excluído de TODOS os cálculos (resultado e saldo).
- A classificação é aplicada **na leitura/processamento** — nunca altera dados no banco.
- Meses fechados continuam intocáveis: triggers já bloqueiam UPDATE/DELETE em `historical_monthly` e `financial_entries`. Mudanças em `type_classifications` não fazem UPDATE em entries existentes.

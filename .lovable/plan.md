# Lucratividade automática (a partir do fechamento de outubro/2026)

## Como vai funcionar
Cada escola passa a ter até **3 lucratividades padronizadas**, calculadas sozinhas com os mesmos números do Dashboard:

| Nome padronizado | Conta |
|---|---|
| **Lucratividade operacional** | Resultado ÷ Receita. Tudo que está como Operação (empréstimos, antecipações, aportes, distribuição de lucros etc.) fica de fora. Substitui "sem empréstimo", "sem dívida", "Operacional", "s/ PF"... |
| **Lucratividade total** | Considera tudo: Resultado − saídas de operação + entradas de operação, ÷ Receita. Transferências entre contas próprias continuam fora porque se anulam. Substitui "com empréstimo", "com dívida", "com DL"... |
| **Lucratividade com receita integral** | Só aparece se a escola tiver a receita integral preenchida (veja abaixo). Mesma conta da operacional, mas dividindo pela receita integral e somando a diferença na receita. |

### Receita integral (escolas com antecipação)
- No **Dashboard**, novo campo por mês: "Receita integral do mês" (o que a escola faturaria sem antecipações), preenchido pela equipe.
- O Dashboard passa a mostrar **dois fechamentos lado a lado** quando o campo está preenchido:
  - **Receita que entrou** — vem do Fluxo Bancário/realizado, como hoje.
  - **Receita integral** — resultado recalculado trocando só a receita pelo valor digitado.
- As outras abas (Indicadores, relatório) puxam os dois daqui, sem digitar de novo.

### Quando grava
- Ao **fechar o mês** (outubro/2026 em diante), as lucratividades são gravadas nos Indicadores e travadas com o fechamento.
- Meses abertos mostram o valor calculado ao vivo, com o selo "automático".
- Setembro/2026 para trás fica como está (digitado).

### Padronização dos nomes
- Os ~40 nomes diferentes de lucratividade nas escolas são mapeados para os 3 nomes acima, mantendo o histórico já digitado. Nomes que não se encaixam (ex.: "Jurassic sem franqueadora", "Com/Sem Pró-Labore", "Com/Sem C.P") ficam como estão e eu te mostro a lista para decidir antes de mexer.

## Próximas partes (depois)
Ticket médio mensal/semestral e ponto de equilíbrio, usando a mesma base.

## Detalhes técnicos
- Cálculo puro novo em `src/lib/profitability.ts` consumindo somente totais do `ledgerEngine`/`tipoMeta` (receita, despesa, operações entrada/saída) — nada de sinal do valor. Teste em `src/test/profitability.test.ts` com casos concretos (operação fora da operacional, dentro da total; integral só com campo preenchido; divisão por zero = vazio).
- Novo campo: tabela `monthly_integral_revenue (school_id, month, valor, updated_by, updated_at)` com GRANT, RLS por acesso à escola + RESTRICTIVE `can_see_school`, guarda de mês fechado.
- `kpi_definitions` ganha `auto_key` (`lucro_operacional` | `lucro_total` | `lucro_integral`); migração de dados mapeia nomes existentes e cria os que faltam nas escolas que já usam lucratividade.
- Gravação em `kpi_values` no fluxo de fechamento (`period_closures`), apenas meses >= 2026-10; meses abertos calculados no frontend em `Indicadores.tsx`.
- Dashboard: card de dois fechamentos + campo de receita integral em `Dashboard.tsx`.

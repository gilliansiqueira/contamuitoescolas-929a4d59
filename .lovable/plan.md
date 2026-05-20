# Plano — Modelos Financeiros + Simulação Planilha

Dois blocos independentes. Execução em ordem: A → B.

---

## Bloco A — Modelos Financeiros (templates de tipos)

### Conceito
- **Modelo global** = template reutilizável (ex.: Escola, Clínica, SaaS, Personalizado), compartilhado entre todas as empresas.
- **Empresa** = ao escolher um modelo, recebe uma **cópia independente** dos itens. Pode editar/excluir/adicionar livremente, sem afetar o template original nem outras empresas.
- Fonte única de classificação no Histórico Financeiro: a lista da própria empresa (que hoje já é `type_classifications` por `school_id`).

### Banco de dados (migration)

Novas tabelas globais (sem `school_id`):

```sql
financial_model_templates
  id, name, description, is_system (bool), created_at

financial_model_template_items
  id, template_id, name, tipo ('entrada'|'saida'),
  impacta_caixa (bool), entra_no_resultado (bool), sort_order
```

RLS: SELECT público autenticado; INSERT/UPDATE/DELETE só `is_admin()`. Templates `is_system=true` não podem ser excluídos.

Adicionar à tabela `schools`:
```sql
ALTER TABLE schools ADD COLUMN financial_model_template_id uuid NULL;
```

Seed dos 4 templates base (Escola / Clínica / SaaS / Personalizado vazio) com itens default conhecidos (Receita, Despesa, Aporte, Distribuição de Lucros, etc.).

### Aplicar modelo na empresa
Função client-side `applyTemplateToSchool(schoolId, templateId)`:
1. Lê `financial_model_template_items` do template.
2. Para cada item, faz upsert em `type_classifications` com:
   - `tipoValor = nome` (key normalizado)
   - `label = nome`
   - `classificacao = 'receita'|'despesa'|'operacao'` (entrada+entraResultado=receita; saída+entraResultado=despesa; senão operacao)
   - `entraNoResultado`, `impactaCaixa` conforme item
3. **Não apaga** o que já existe na empresa (apenas adiciona/atualiza por chave). Após cópia, a empresa fica 100% independente.

### UI

**1. Configurações > Modelos Financeiros** (nova rota/aba dentro do menu Configurações, ao lado de "Histórico Financeiro"):
- `src/components/ModelosFinanceirosManager.tsx`
- Lista de templates com ações: Criar / Editar / Duplicar / Excluir (admin).
- Editor do template: nome + tabela inline de itens (Nome | Tipo | Impacta saldo | Entra no resultado) com add/edit/delete por linha.

**2. SchoolSelector / Cadastro de Empresa**:
- Adicionar `<Select>` "Modelo Financeiro" ao criar/editar escola.
- Botão "Aplicar modelo agora" que chama `applyTemplateToSchool` (com confirmação).

**3. Histórico Financeiro** (`HistoricoFinanceiroConfig.tsx` + telas que usam `tipo_valor`):
- Verificar que o dropdown de tipo já lê de `type_classifications` da escola atual. Se houver algum hard-code, remover.

---

## Bloco B — Simulação como planilha matricial

Substituir o `Simulation.tsx` atual (matriz com linhas Nº Vendas/Ticket/Parcelas) por um grid Excel-like **por produto**.

### Schema (migration)

```sql
simulation_products
  id, school_id, nome, valor_unitario numeric, parcelas int,
  sort_order, created_at, updated_at

simulation_monthly_quantities
  id, school_id, product_id, month text ('YYYY-MM'),
  quantity int, UNIQUE(product_id, month)
```

RLS padrão: `is_admin() OR user_has_school_access(auth.uid(), school_id)`.

### UI — `src/components/Simulation.tsx` (rewrite)

Tabela com scroll horizontal, primeiras 3 colunas fixas (sticky):

```
Produto        | Valor   | Parcelas | Jan | Fev | Mar | ... | Dez
Curso X        | 3.000   | 6        |  20 |  50 |  15 | ... |
[+ Adicionar produto]
```

Linhas:
- **Editáveis**: nome, valor, parcelas, quantidades por mês.
- Botão remover por linha.
- Botão "Adicionar produto" no final.
- Persistência: debounce save por célula (upsert em `simulation_monthly_quantities`).

### Cálculo de recebimento

Para cada produto:
- `totalVendidoMes = quantidade[m] * valor_unitario`
- `parcelaValor = totalVendidoMes / parcelas`
- Distribui `parcelaValor` em `m, m+1, ..., m+parcelas-1` (1ª parcela no próprio mês da venda).
- Soma de **todas as parcelas de todos os produtos** por mês = `receita_simulada[mes]`.

### Quadro de consolidação (abaixo da tabela)

```
Mês       | Projeção (sistema) | Simulação | Total
Jan 26    | R$ 100.000         | R$ 25.000 | R$ 125.000
...
```

- `Projeção (sistema)` = soma de `financial_entries` (tipo_registro='projetado', tipo='entrada') do mês.
- `Simulação` = `receita_simulada[mes]` calculado acima.
- **Simulação NÃO grava em `financial_entries`** — fica isolada, apenas visualização. (atende "não impacta nas outras abas").

### Filtro de meses
Reusa o `MonthSelector` multi-mês existente: filtra colunas exibidas e linhas do quadro de consolidação.

---

## Ordem de entrega
1. Migration Bloco A (tabelas + seed templates).
2. UI Modelos Financeiros + aplicar-na-empresa.
3. Migration Bloco B (tabelas simulação).
4. Rewrite `Simulation.tsx` (grid + consolidação).

## Fora de escopo
- Não mexer em outras abas/dashboards além do `Simulation.tsx`.
- Não alterar como `type_classifications` é consumida hoje (só garantir que continua sendo a fonte).
- Sem migração automática dos dados antigos da simulação anterior (será descartada).

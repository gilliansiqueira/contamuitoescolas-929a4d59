# Central de Clientes — proposta (etapa 1)

Nada será implementado antes da aprovação das 4 prévias.

## Passo 1 — Prévias para aprovação
Gerar e mostrar, separadamente, na direção "Modern orange frame" já aprovada:
1. Central de Clientes — modo claro
2. Central de Clientes — modo noturno
3. Menu do cliente — modo claro (o atual, com o laranja `#E05E08 → #D1540A` e engrenagem só para admins)
4. Menu do cliente — modo noturno (laranja queimado `#9A3412`)

Após a sua escolha/ajustes, sigo para o passo 2.

## Separação das experiências
- Equipe Conta Muito (admin): entra na Central de Clientes.
- Cliente com 1 empresa: vai direto ao Dashboard.
- Cliente com mais de uma empresa: seleção simples só das empresas autorizadas (sem percentuais, responsáveis ou carteira).
- A tela atual de seleção permanece disponível até a validação da nova.

## Menu interno da equipe
Carteira de Clientes, Conciliação, Importações, Fechamentos, Pendências, Equipe e Acessos, Configurações. Nunca aparece para clientes.

## Origem de cada informação

| Informação | Já existe? | Fonte |
|---|---|---|
| Empresas ativas | Sim | cadastro de empresas |
| Dados atualizados até | Sim | data do último lançamento importado / último extrato bancário |
| Atualizada hoje | Sim | data da última importação = hoje |
| % Conciliação | Sim, apenas empresas do piloto Fluxo Bancário | movimentações bancárias do mês |
| Período fechado | Sim | fechamentos de período (por mês e módulo) |
| Responsável interna | Não | precisa ser criado |
| Checklist de fechamento | Não | precisa ser criado |
| Pendências | Parcial | conciliações pendentes + etapas do checklist em aberto |

### % Conciliação
`conciliadas ÷ (total − "Não se aplica") × 100`, no período selecionado.
Empresas fora do piloto mostram "Sem conciliação" (não 0%, não inventado).

### % Fechamento
Não existe hoje fonte confiável para todas as etapas. Proposta de checklist por empresa e mês:
- Extratos atualizados — automático (extrato cobre até o fim do mês)
- Conciliação concluída — automático (100%)
- Período fechado — automático (fechamento registrado)
- Fluxo de caixa atualizado, Despesas importadas, Receitas atualizadas, Relatórios conferidos — marcação manual da equipe, com quem/quando

Cada empresa pode marcar etapas como "não se aplica". Fórmula: `concluídas ÷ aplicáveis × 100`.

### Situação geral (regra sugerida)
- Fechamento concluído: 100% das etapas aplicáveis.
- Atrasada: dados sem atualização há mais de 7 dias, ou mês anterior sem fechamento após o dia 10.
- Atenção: há conciliações pendentes ou etapas abertas, mas dentro do prazo.
- Em dia: dados atualizados nos últimos 7 dias e sem pendências vencidas.
(Prazos 7 dias/dia 10 ajustáveis — confirme.)

## Tela
- Cards: ativas, atualizadas hoje, conciliação pendente, fechamento pendente, fechamentos concluídos — clicáveis como filtros.
- Tabela: empresa, responsável, período, atualizado até, % conciliação e % fechamento com barra, pendências, situação, "Acessar" e menu discreto (Dashboard, Fluxo Diário, Conciliação, Importar, Pendências, Configurações).
- Filtros: busca, responsável, situação, faixa de conciliação, fechamento, período, desatualizadas, com pendências; ordenação "precisam de atenção primeiro".
- "Nova empresa" só para admins; excluir empresa fora da tela principal.

## Detalhes técnicos
- Novas tabelas (migration, com GRANT + RLS apenas admin): `school_assignments` (school_id, user_id responsável), `closing_checklist_items` (school_id, month, step_key, status concluída/aberta/nao_aplica, done_by, done_at).
- Leitura agregada por função `security definer` restrita a `is_admin()`, retornando uma linha por empresa — clientes não conseguem chamá-la.
- Novo componente `ClientCenter` substituindo `SchoolSelector` apenas para admins em `Index.tsx`; `SchoolSelector` mantido para clientes multi-empresa e como reversão (flag simples).
- Nenhum cálculo financeiro, relatório ou motor SSOT alterado.
- Testes: Playwright claro/noturno, usuário admin e usuário cliente.

## Reversão
Voltar `Index.tsx` para o `SchoolSelector`; tabelas novas não afetam dados existentes.

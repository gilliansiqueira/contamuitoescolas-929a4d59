# Rondonópolis — "Análise de despesas" na Central

## O que acontece hoje
- As despesas de setembro de Rondonópolis estão no sistema (220 lançamentos), e a etapa **Contas pagas** já está marcada automaticamente.
- O card "Análise de despesas" continua pendente por causa da outra etapa dele, **Conciliação de despesas**, que só se marca quando a conciliação bancária chega a 100%.
- Rondonópolis **não tem nenhuma conta bancária cadastrada** no Fluxo Bancário, então não há nada para conciliar. Com isso, a etapa nunca se marca sozinha e o card fica preso em pendente.

## O que vou fazer
1. **Empresas sem conta bancária cadastrada:** a etapa "Conciliação de despesas" passa a ficar como **"Não se aplica"** automaticamente, com a nota "Empresa sem conta bancária no sistema". Assim, o card "Análise de despesas" fica concluído quando as Contas pagas entram.
2. Quando a empresa cadastrar uma conta, a etapa volta a exigir a conciliação de 100%, como hoje.
3. Nada que a equipe marcou à mão é desfeito.
4. Atualizar setembro em todas as empresas ativas e conferir Rondonópolis na Central: "Análise de despesas" deve aparecer como concluída. Também vou listar quais outras empresas estão na mesma situação.

## Efeito nos números
Nenhum. Só muda o andamento do relatório na Central.

## Técnico
- `_refresh_report_progress`: se a empresa não tem `bank_accounts` ativa e não virtual, `desp_conciliacao` vai para `not_applicable` com `source='automatic'` e uma nota. Isso só vale para etapas automáticas (`completed_by IS NULL`). Se surgir conta, reabre para `open` e volta à regra atual.
- Confirmar que a Central já trata `not_applicable` como fechado ao contar pendentes e concluídas (`status !== 'open'`).
- Backfill: `_refresh_report_progress(id, '2026-09')` nas empresas ativas.

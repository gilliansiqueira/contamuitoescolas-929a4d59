# Supervisoras acompanham e trabalham na carteira das meninas

## Como fica
- Em **Equipe e acessos**, cada pessoa da equipe ganha o campo **"Supervisiona"**, onde você escolhe uma ou mais colegas. Por exemplo: Ana supervisiona Hannah, e Isa supervisiona Geovanna.
- A supervisora passa a ter, automaticamente, as empresas da carteira das supervisionadas:
  - aparecem na Central dela, com conciliação, tarefas e relatório;
  - ela pode abrir essas empresas e trabalhar nelas normalmente.
- Na Central da supervisora, essas empresas ficam separadas pelo nome da colega ("Carteira da Hannah"), para ela acompanhar o andamento.
- Quando você passa uma empresa para a Hannah ou tira dela, a Ana ganha ou perde o acesso junto. Não é preciso fazer nada duas vezes.
- A responsável pela empresa continua sendo a menina. A supervisora não vira responsável automaticamente.
- Só você define quem supervisiona quem.

## Observação
Hoje a Isa está configurada para ver **todas as empresas**. Vou trocar para "lista definida" com a carteira atual dela, para que ela passe a ver só as empresas dela mais as da Geovanna. Se preferir que ela continue vendo tudo, é só me avisar.

## Preservado
Nenhum cálculo, relatório ou lançamento muda. As regras de exclusão continuam só com você.

## Detalhes técnicos
- Nova tabela `team_supervision(supervisor_id, member_id)`: grants, RLS de leitura para is_admin e escrita só para super_admin.
- `user_has_school_access`, `admin_manages_school` e o filtro de `get_management_portfolio`/RPCs da carteira passam a incluir `user_schools` das supervisionadas. Isso fica dentro de `can_see_school`, que continua valendo.
- `useAuth.loadProfile` soma as empresas das supervisionadas a `accessibleSchoolIds`. A Central agrupa por responsável quando há supervisão.
- UI: seletor múltiplo "Supervisiona" nas linhas da equipe em `UsersConfig` (só super_admin).
- Dados: Ana → Hannah; Isa → Geovanna; `admin_scope` da Isa para `list`.

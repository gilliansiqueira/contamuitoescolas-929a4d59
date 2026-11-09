## Corrigir "Salvar texto" e "Salvar orientações"

**Causa encontrada**
- As duas tabelas que guardam o texto do relatório e as orientações por empresa estão sem permissão de gravação para usuários logados (nenhuma liberação de acesso foi concedida). Por isso qualquer pessoa recebe erro ao salvar.
- Além disso, a regra das orientações só aceita quem tem a escola na própria carteira; super admin e quem gerencia todas as empresas (Gisele, Isabelly, Ana, Thau, Hannah) ficariam bloqueados mesmo depois da correção.

**O que será feito (uma mudança no banco)**
- Liberar leitura e gravação dessas duas tabelas para usuários logados.
- Trocar a regra de quem pode salvar pela regra administrativa padrão (super admin, ou equipe com acesso à empresa ou escopo "todas as empresas"), mantendo o bloqueio de empresas restritas.
- Clientes continuam sem acesso.

**Verificação**
- Conferir as permissões no banco depois da mudança e testar salvar texto e orientação em Pinheirinho.

### Detalhes técnicos
- `GRANT SELECT, INSERT, UPDATE, DELETE` em `report_writing_guidelines` e `monthly_report_analyses` para `authenticated`.
- Recriar as políticas permissivas usando `admin_manages_school(school_id)`; manter as RESTRICTIVE `can_see_school`.

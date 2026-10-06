# Cada funcionária vê o próprio ponto

## O que muda para a equipe
- No login de cada menina aparece um cartão "Meu ponto" na Central: batidas do dia, horas extras e faltas do mês, com a data da última atualização.
- Ela vê **somente o próprio ponto**, nunca o de outra pessoa.
- Tela só de visualização: sem importar, ocultar, vincular ou qualquer botão de gestão.
- Única ação: em dia com batida faltando, falta ou atraso, botão "Justificar" para escrever o motivo. Você vê a justificativa no Ponto da Equipe (e pode marcar como aceita ou não). A justificativa não altera as horas calculadas.
- Sempre que você importar o relatório do PontoFopag, o ponto dela se atualiza junto, sem nada a mais; as justificativas são mantidas.

## O que você faz uma vez
- No Ponto da Equipe, cada funcionário ganha um campo "Login vinculado", onde você escolhe o usuário do sistema dessa pessoa. Quem não tiver vínculo não vê nada.

## Detalhes técnicos
- Migração: coluna `team_time_employees.user_id uuid` (única, nula por padrão), editada só pela Edge Function `pontofopag-sync` (nova ação `link_user`, só super_admin).
- Função `is_own_team_time_employee(_employee_id)` (security definer) e políticas SELECT adicionais em `team_time_employees`, `team_time_daily`, `team_time_occurrences`, `team_time_hour_bank` permitindo leitura só da própria linha (`user_id = auth.uid()`). Leitura completa continua `is_super_admin()`/`can_view_team_time()`; escrita continua só pela função.
- Frontend: hook `useMyTeamTime` reutilizando as regras de cálculo já usadas no Ponto (extras, faltas, "Em andamento", dia atual) — sem duplicar lógica; cartão `MyTeamTimeCard` na Central/Meu Dia; seletor de login na tela do Ponto.
- Nova tabela `team_time_justifications` (employee_id, dia, motivo, status pendente/aceita/recusada, criado_por, revisado_por) com GRANT e RLS: a funcionária insere/edita apenas a do próprio vínculo enquanto pendente; super_admin lê e revisa. Não é tocada pelo sync, então sobrevive às reimportações.
- Registrar a regra no AGENTS.md / conhecimento do projeto.
- Verificação: entrar como uma funcionária vinculada e confirmar que só a própria pessoa aparece.

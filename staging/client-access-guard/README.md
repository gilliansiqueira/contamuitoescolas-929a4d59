# Acessos e senhas — proteção (SÓ TESTE ISOLADO, nada promovido)

Executar a partir da raiz do projeto: `bash staging/client-access-guard/run.sh`
Cria um PostgreSQL 17 descartável em `mktemp -d /tmp/acc-pg.XXXXXX` (só socket, `listen_addresses=''`), zera variáveis PG*/DATABASE_URL/LOVABLE_DB_MIGRATION_URL, aborta se o destino não for `acessos_descartavel|socket|<pasta criada>`, e apaga a pasta ao sair (também em falha).

## Proposta revisada
- **Usar** (ver lista, revelar/copiar senha e 2ª senha atuais): grupo de apoio `user_permissions.access_use` + quem edita. Vale só neste módulo.
- **Editar** (criar, alterar, arquivar, restaurar versão, ver senha antiga, marcar restrito): papel admin + vínculo com a empresa por `user_has_school_access` — inclui perfil, `user_schools` e supervisão (`team_supervision`), não só a responsável da carteira — ou administrar.
- **Administrar** (item restrito, tirar restrição, auditoria): super_admin ou admin com `access_admin`.
- **Item restrito**: revelação atual e antiga, edição, arquivamento, restauração e remoção da restrição exigem administrar. Restaurar nunca tira a restrição: o item fica restrito se ele OU o snapshot restaurado for restrito. Versão antiga fica protegida se a versão ou o item atual for restrito.
- **Empresa restrita**: continua só super_admin (`can_see_school`), inclusive para `access_admin`.
- **Texto livre retirado**: `extras`/`observacao` deixam de ser gravados e expostos. Ficam metadados fixos: `tipo_login` (individual/compartilhado/consulta), `codigo_operador` (só dígitos, até 12), `celular_token` (só dígitos). Segredo extra só no campo cifrado `secret2_enc`, tipo único `senha_app` (2ª senha de acesso ao sistema). Senha de transação e frase de recuperação NÃO são aceitas: credenciais críticas ficam fora do protótipo e exigiriam tratamento separado e restrito. Isso reduz, mas não impede, alguém digitar segredo num campo permitido.
- **Ocultação**: só visual na tela (senha some após alguns segundos). Limpeza da área de transferência NÃO é prometida. Não implementado nem testado aqui (exigiria mexer em src/).
- **Auditoria**: `get_access_audit(empresa)` devolve e-mail, empresa, serviço, horário e ação de usos (ver/copiar) e mudanças (criar, editar, arquivar, restaurar, restringir, remover restrição), sem senhas nem valores antigos; só administrar.
- **Risco explícito, não aceito em nome da Bruna**: a chave de cifra fica no mesmo banco (`private.access_key`). Quem controla o backend decifra. É criptografia no banco, não cofre ponta a ponta.

## Arquivos
- `schema-stub.sql` — papéis, `auth.uid()` simulado, tabelas mínimas e funções de permissão COPIADAS de 0013, supabase/20260419, 0066, 0113, 0080.
- migrations reais `drizzle/migrations/0096–0098` — lidas sem alteração.
- `harness.sql` — executor por papel/usuário e dados fictícios (@exemplo.test).
- `tests.sql` (código atual) · `proposal.sql` · `tests2.sql` (proposta) · `run.sh`.

## Resultado
82 de 82 passaram (7 código atual, 75 proposta) em 10/11/2026. Cópia sabotada (restauração sem manter restrição, senha_transacao liberada, auditoria sem mudanças) gerou falhas nos testes correspondentes.

## O que NÃO foi provado
- `auth.uid()`, papéis `anon/authenticated/service_role` e tabelas `schools/profiles/user_schools/user_roles/user_permissions` são stubs; políticas reais dessas tabelas, gatilhos e grants padrão do backend não foram comparados.
- Tela (ocultação visual, novo formulário), API HTTP e JWT reais.
- Migração dos dados existentes de `extras`/`observacao` (seria preciso revisar antes de apagar).
- Concorrência e desempenho.

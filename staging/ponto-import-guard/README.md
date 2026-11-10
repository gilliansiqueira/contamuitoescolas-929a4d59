# Proteção da importação do Cartão Ponto — PREPARADO, NÃO APLICADO
Pasta fora dos caminhos com deploy automático. Nada aqui chega ao banco real, às funções ou ao app publicado.

## Arquivos
- `validate.ts` — validação estrita (esquema permitido, datas reais, durações HH:MM com minutos 00–59, totais conferidos, dias vazios).
- `rpc.sql` — função transacional `team_time_import_report` (só service_role) + colunas `attempt_id`/`content_hash` (aditivo).
- `edge-patch.ts` — invólucro do servidor com portas injetáveis (`handle`, `importReport`, `importStatus`); ligação real comentada no fim.
- `importClient.ts` — cliente com `attempt_id` estável, consulta `import_status` e reenvio na mesma tentativa; ligação real comentada.
- `client-patch.md` — mudança da tela (enviar `totais` e `attempt_id`).
- `schema-stub.sql` + `integration.sql` + `integration.sh` — integração em PostgreSQL descartável.

## Comandos (a partir da raiz do projeto)
```
bunx vitest run --config staging/ponto-import-guard/vitest.config.ts
(cd staging/ponto-import-guard && deno check validate.ts edge-patch.ts importClient.ts)
staging/ponto-import-guard/integration.sh
```
`integration.sh`: cria pasta exclusiva com `mktemp -d`, porta aleatória, só socket local, zera variáveis PG*, confere `ponto_descartavel|socket` antes do SQL e remove apenas a própria pasta (inclusive se initdb/start falharem). Como root, roda o banco com o usuário `lovable` via `setpriv`.

## Contagens (última execução)
- Unitários: 64 (validação 27, servidor com mocks 28, cliente com mocks 9).
- Integração: 18 cenários SQL + 2 de concorrência (mesma tentativa; intervalos diferentes sobrepostos).

## Regras de comportamento
- Dia totalmente vazio (sem jornada, batidas, observação e horas): ignorado; o que já existir no banco é mantido.
- Dia só com horas (sem batidas): gravado, nunca descartado.
- Marcações mantidas na ordem do relatório (jornada noturna).
- Só códigos determinísticos (22xxx, 23xxx, 42xxx, P0001) contam como desfeito (registra só `rpc_error:<código>`). Classe 08, 08007, 40003, 57xxx, 40001 e qualquer código desconhecido, transporte ou exceção = consulta a tentativa; sem confirmação responde "incerto" (nunca `rolled_back`).
- O cliente só aceita sucesso de `import_status` se `content_hash` for igual ao hash esperado do próprio payload (mesma validação do servidor); diferente ou ausente = `conflict`.

## Limites (não verificado)
- Testes usam schema mínimo; não comparado de novo com o banco real (RLS, gatilhos, `is_super_admin` reais).
- Servidor e cliente testados só com mocks; sem teste de runtime real da função, de interface nem do build do app.
- A lista de códigos determinísticos depende do cliente do backend repassar o SQLSTATE; conferir na promoção. Códigos determinísticos fora da lista viram "incerto" (seguro, porém menos informativo).
- O cliente importa `validate.ts`; na promoção o mesmo arquivo precisa existir no app e na função (contrato de hash idêntico).
- Retry com outro `attempt_id` reaplica por upsert sem duplicar dias, mas gera outro registro de execução.

## Homologação com app integrado e schema completo (sem servidor real) — pasta fullschema/
Ambiente: Node 22, Deno 2.8, PostgreSQL 17 local, Playwright/Chromium. **Ausentes:** Docker/Podman (sem `supabase start`, Auth, PostgREST, Edge Runtime local).
Cópia do código em `mktemp -d /tmp/ponto-homolog.XXXX` (sem .git, sem .env, sem PDFs/planilhas/fixtures reais, sem backup_demo_entries.json e scripts de dados), com env fictício
`VITE_SUPABASE_URL=http://127.0.0.1:9`; o bundle gerado não contém o identificador do projeto real. Patches aplicados SÓ na cópia: `patches/app-integration.diff` + `patches/NEW-FILES.md`.

Resultados na cópia integrada (comparados com a mesma cópia antes do patch):
- `vite build`: OK antes e depois.
- `tsc -p tsconfig.app.json`: 15 erros antes e depois, os mesmos (14 por fixtures reais excluídas da cópia + 1 em descricaoParser.ts). Nenhum novo.
- `deno check` da função: 8 erros no original, 5 na integrada, todos o mesmo tipo pré-existente (cliente admin passado a `call`). Nenhum novo.
- `eslint` nos 3 arquivos tocados: 8 erros antes e depois (todos `any` pré-existentes). Nenhum novo.
- Testes do ponto existentes: 21/21 (cartaoPonto.test.ts não roda: fixture real excluída).
- Testes da pasta staging: 64/64.

Schema completo: `bash staging/ponto-import-guard/fullschema/run.sh <copia-em-/tmp>`
- `strip.py` remove das migrations todo INSERT/UPDATE/DELETE/COPY/TRUNCATE de nível superior e `select cron./net.` (lista em `removed-data-statements.json`, só nomes de arquivo); corpos de funções ficam.
- `prelude.sql` cria stubs mínimos de auth/storage/papéis. 162 de 165 migrations aplicadas; não aplicadas: 0082 (correção de dados de uma escola, depende de linhas reais), 0108 (exige pg_cron) e 0109 (depende da 0108). Nenhuma das três toca team_time_*.
- `tests.sql` (schema completo + rpc.sql): 19/19, incluindo RLS real (`is_super_admin` via user_roles), justificativas e batidas ignoradas reais.
- `e2e.test.ts`: leitor do PDF (tokens sintéticos) → mapeamento da tela → importClient → importGuard → RPC no banco: 7/7 (sessão expirada, sem permissão, gravação, duplicação, correção, timeout após commit, total divergente).

Limites: o schema vem dos arquivos do repositório, não do banco real — não se afirma equivalência (mudanças feitas fora dos arquivos não aparecem). Sem Auth/PostgREST/Edge Runtime, não foi testado: a função rodando de fato, o
`supabase.functions.invoke` real (formato do erro/status), o código SQLSTATE repassado pelo PostgREST, nem a tela no navegador.

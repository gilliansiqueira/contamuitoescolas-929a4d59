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

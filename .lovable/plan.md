# Proteção da importação do Cartão Ponto (somente teste isolado)

## 1. O que é realmente isolado (verificado nesta sessão)
- **Isolado de verdade:** um PostgreSQL 17 descartável criado do zero em `/tmp` (`initdb` + `pg_ctl` na porta local, socket próprio). Existe no sandbox e não tem ligação com o banco do app. Atenção: o sandbox já tem variáveis `PG*` apontando para o banco do projeto; todo comando de teste vai zerá-las (`env -u PGHOST -u PGUSER -u PGPASSWORD -u PGDATABASE -u PGPORT`) e usar `-h /tmp/pgtest` explicitamente, com checagem de que o banco conectado é o descartável antes de rodar qualquer SQL.
- **Isolado:** testes unitários (vitest/deno test) com dados sintéticos e checagem de tipos/build feita automaticamente pelo ambiente.
- **NÃO isolado:** o preview usa o mesmo backend da produção (um único backend serve preview e app publicado). Chamar a função pelo preview grava em produção.
- **Rascunho (draft) com backend próprio:** existe recurso de rascunho com backend separado, mas não verifiquei seu custo nem o isolamento real; não será usado sem nova autorização.

## 2. Aplicação/deploy automático — o risco principal
- **Edge Functions:** editar `supabase/functions/pontofopag-sync/*` dispara **deploy automático** ao fim da mensagem. Portanto **não editarei esse arquivo** nesta etapa.
- **Migrations:** o projeto usa `drizzle/migrations` (última: 0112). Elas são aplicadas pela ferramenta de migração; editar arquivo por si não aplica, mas um arquivo novo/pendente seria aplicado na próxima migração de qualquer pessoa. Portanto **não criarei arquivo nessa pasta**.
- **Frontend (`src/`)**: mudanças vão para o preview imediatamente e para produção só ao publicar — mesmo assim, o hook chamaria a função de produção. Também não alterarei `useTeamTimeImportReport` agora.

## 3. Onde o código ficará até a confirmação
Tudo em pasta fora dos caminhos com deploy: `staging/ponto-import-guard/`
- `rpc.sql` — função `team_time_import_report(payload jsonb)`.
- `validate.ts` — validação pura (compartilhável com a Edge Function depois).
- `edge-patch.ts` — nova `importReport` pronta para colar na função.
- `hook-patch.ts` — ajuste do chamador.
- testes: `validate.test.ts`, `integration.sh` + `integration.sql`.
Para promover depois: copiar para os caminhos reais só após sua confirmação.

## 4. Desenho da correção
**Validação estrita (servidor, antes de gravar):** datas ISO válidas e reais, período ini<=fim e limite de dias; cada dia dentro do período e sem repetição por pessoa; marcações no formato HH:MM, ordenadas, sem descartar/truncar em silêncio (excesso = erro); minutos não negativos; totais impressos recalculados no servidor e comparados aos dias — divergência bloqueia. Recusa qualquer campo parecido com CPF/PIS (11 dígitos, chaves `cpf`/`pis`).

**RPC transacional (só service_role, `SECURITY DEFINER`, `REVOKE` de `anon`/`authenticated`):** numa única transação:
1. trava por período (`pg_advisory_xact_lock`) contra importações concorrentes;
2. idempotência: chave = hash do conteúdo; se já houver execução `success` com a mesma chave, retorna o resultado anterior sem regravar (resolve timeout após commit);
3. upsert de funcionários só em nome/cargo — nunca toca `user_id`, `oculto`, `desligado_em`, `horario_override`;
4. upsert de `team_time_daily` por (pessoa, dia) **apenas nos dias lidos** — mantém IDs, dias ausentes preservados, sem DELETE de intervalo;
5. ocorrências: substitui só `origem='relatorio_pdf'` nos dias lidos; outras origens intactas;
6. justificativas e `team_time_daily_overrides` não são tocadas;
7. registra execução e contagens; qualquer erro desfaz tudo.

**Edge Function:** confere `is_super_admin()` do chamador, valida, chama a RPC uma vez; checa erros de criação/finalização do registro de execução; em timeout o cliente consulta a execução pela chave em vez de reenviar às cegas.

**Reaproveitar 2–3 dias anteriores:** sobreposição vira upsert dos mesmos dias, sem duplicar.

## 5. Testes (todos sintéticos, sem CPF/PIS)
- Unitários: os 15 de validação + datas inválidas, marcações excedentes, totais divergentes, campos proibidos.
- PostgreSQL descartável (esquema mínimo das tabelas `team_time_*`, papéis `service_role`/`authenticated` simulados e stub de `is_super_admin`):
  - falha tardia forçada (gatilho que aborta no último insert) → nada muda;
  - repetição idêntica → sem duplicatas, mesmos IDs;
  - sobreposição de 3 dias → atualiza só esses dias;
  - dias ausentes → preservados;
  - campos preservados (justificativas, overrides, user_id, oculto, desligado_em, horario_override, ocorrências de outra origem);
  - concorrência (duas sessões) → segunda espera e vira idempotente;
  - acesso: `authenticated`/`anon` recebem permissão negada.
- Ao final, `pg_ctl stop` e remoção da pasta.

## 6. Bloqueios e custos
- Sem custo de compra conhecido; o banco descartável é local. Uso normal de créditos da conversa.
- Esquema do teste é uma réplica mínima, não um dump de produção — diferenças de colunas reais serão conferidas por leitura (somente SELECT de estrutura) antes da promoção.
- Não validado: comportamento do runtime real da Edge Function e do preview; isso exige a etapa de publicação autorizada.
- Promoção futura (migração + deploy da função + ajuste do hook) só com sua confirmação explícita.

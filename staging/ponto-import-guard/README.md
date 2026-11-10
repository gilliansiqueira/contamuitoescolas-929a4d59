# Proteção da importação do Cartão Ponto — PREPARADO, NÃO APLICADO
Pasta fora dos caminhos com deploy automático. Nada aqui chega ao banco, às funções ou ao app publicado.
- `validate.ts` + `validate.test.ts` (18 testes, dados fictícios): `bunx vitest run --config <node> staging/ponto-import-guard`
- `rpc.sql`: função transacional (só service_role) + colunas `attempt_id`/`content_hash` (aditivo).
- `integration.sh`: banco PostgreSQL descartável em /tmp (variáveis PG* zeradas, trava de conferência), 16 cenários + concorrência.
- `edge-patch.ts` / `hook-patch.ts`: trechos para promover depois.
Promoção (só com autorização): migração com `rpc.sql`; copiar `validate.ts` e `edge-patch.ts` para a função `pontofopag-sync` (dispara deploy); ajustar hook e enviar `totais` em ImportCartaoPonto.

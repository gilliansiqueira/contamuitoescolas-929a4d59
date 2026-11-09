# Diagnóstico: conectores de operadoras (somente leitura) — piloto WNC / Mercado Pago

Este documento é só diagnóstico e roteiro. Nada foi alterado: código, banco, rotinas automáticas, Inter e Olist ficam como estão.

## 1. Estado atual (conferido no código)

- **Edge Functions existentes:** `inter-sync`, `olist-sync`, `pontofopag-sync`, `draft-monthly-analysis`, `help-ask`, `categorize-expense`, `audit-import-differences`, `verify-sponte-classification`, gestão de usuários. **Nenhuma** função de operadora (Stone, Mercado Pago, PagBank, Getnet, Rede).
- **Maquininha hoje = só arquivo:** parsers em `src/lib/bankStatements/parsers.ts` (há teste `pagbankAReceber.test.ts`), guarda Sponte×maquininha em `src/lib/import/sponteCardGuard.ts`.
- **Cruzamento já existente (puro, testado):** `src/lib/receiptThreeWayMatch.ts` (previsão → repasse → banco, até 2 dias úteis, cada depósito usado uma vez) e `src/lib/reconSuggest.ts`, exibidos em `src/components/fluxo-bancario/ReconAssist.tsx` e ativados por `school_features.conciliacao_assistida`. Só ligam lançamentos, não criam valores.
- **Modelo a copiar:** Inter (`bank_api_connections`, `bank_api_sync_runs`, colunas `*_enc` sem SELECT, RPC service_role, `bank_statement_imports` por leitura, `dedup_hash` único, `syncWindow`/`gapStart` em `inter-sync/mapping.ts`) e Olist (OAuth com refresh em `erp_connections`, `erp_set_secret`/`erp_get_secrets`, log em `erp_push_log`, painel `OlistErpPanel.tsx` dentro de `BankAccountsImports.tsx`).
- **Risco conhecido:** duplicação recente na Olist (41 lançamentos ainda não limpos). Motivo para o novo conector **não escrever em nenhum lugar** fora das próprias tabelas.

## 2. Arquitetura proposta (todas as operadoras)

```text
Operadora (API, só leitura)
   │  OAuth/token por empresa (criptografado, sem SELECT)
   ▼
acquirer-sync (Edge Function, um "adaptador" por operadora)
   │  janela incremental + backfill em blocos
   ▼
acquirer_raw_events        (JSON bruto, id externo único)
   ▼ normalização pura (testada)
acquirer_transactions      (venda/parcela/taxa/estorno/antecipação/liquidação)
acquirer_settlements       (repasses previstos e pagos)
   ▼ cruzamento puro (reaproveita receiptThreeWayMatch)
Painel de conferência: vendas × recebíveis × banco (Inter/OFX)
```

Regras fixas:
- **Nunca cria receita no Fluxo Bancário.** A receita continua vindo do extrato do banco (o depósito). A operadora só explica o depósito: bruto, taxa, antecipação, estorno. Assim a mesma venda nunca entra duas vezes.
- **Nunca escreve na Olist nem mexe em Inter.** Sem baixa, sem lançamento.
- **Sem duplicar:** chave única `(connection_id, provider, external_id, event_kind)`; backfill e incremental usam a mesma gravação "insere ou ignora".
- **Incremental:** começa no dia seguinte ao último evento lido (mesma lógica de `gapStart`), nunca antes da data de início, blocos limitados pela operadora.
- **Log:** `acquirer_sync_runs` (início, fim, janela, lidos, novos, ignorados, erro), igual a `bank_api_sync_runs`.
- **Acesso:** RLS com `admin_manages_school` + RESTRICTIVE `can_see_school`; segredos só por RPC service_role; ativação por empresa em `school_features` (ex.: `conectores_operadoras`).
- Fica fora dos cálculos da SSOT (`projectionEngine`/`ledgerEngine`): é conferência.

## 3. Mercado Pago na WNC — rota segura

- **Autorização:** OAuth do Mercado Pago (aplicativo da Conta Muito, cliente autoriza a própria conta) ou, no piloto, Access Token de produção colado pelo super admin. Guardado criptografado no backend, nunca no navegador. **Não temos credencial hoje** — depende do cliente/conta Mercado Pago da WNC.
- **Dados lidos (só leitura):** pagamentos (busca de pagamentos), relatórios de liberação de dinheiro (*release report*) e de conciliação (*settlement report*), que trazem taxa, parcela, estorno, antecipação e liquidação.
- **Painel:** novo `AcquirerPanel` ao lado do `InterApiPanel`/`OlistErpPanel` em `BankAccountsImports.tsx`: Conectar · Testar (só lê a conta e mostra o nome) · Simular leitura (mostra o que entraria, sem gravar) · Sincronizar · Histórico de leituras.
- **Não toca** em `olist-sync`, `inter-sync`, nem nas rotinas agendadas existentes.

## 4. Conflito com a Olist e Mercado Livre

- A Olist pode já receber as vendas/pedidos do Mercado Pago ou Mercado Livre pela integração nativa dela. Se depois o conector também levasse isso à Olist, duplicaria. Por isso, **no MVP o conector não envia nada à Olist**.
- **Checkout Mercado Pago (e-commerce/link/maquininha Point)** e **marketplace Mercado Livre** são operações diferentes: no Mercado Livre há comissão, frete e repasse do marketplace, e o pedido nasce no Mercado Livre. Na API, distinguir pelos campos do pagamento (origem/marketplace, `collector`, `order` ligado a pedido do Mercado Livre, tipo de operação). O conector grava esse campo `canal` (`checkout`, `point`, `mercado_livre`) e o painel mostra separado.
- Antes de qualquer envio futuro à Olist: auditoria comparando o que a Olist já tem desses canais, em simulação, com aprovação manual.

## 5. Menor MVP seguro (etapas)

1. **Confirmar acesso:** WNC informa se vende por checkout, Point e/ou Mercado Livre e fornece a autorização. Sem isso, parar aqui.
2. **Tabelas novas** (migração): `acquirer_connections`, `acquirer_sync_runs`, `acquirer_raw_events`, `acquirer_transactions`, com RLS, segredos `*_enc` e RPCs service_role.
3. **Edge Function `acquirer-sync`** com adaptador Mercado Pago: ações `save_credentials`, `test`, `simulate`, `sync`. Sem rotina agendada no início.
4. **Normalização pura + testes** (`src/lib/acquirers/mercadopago.ts`, `src/test/acquirerMercadoPago.test.ts`): bruto → líquido, taxa, parcela, estorno, canal; chave de duplicidade; reler a mesma janela não cria nada novo.
5. **Painel** com simulação obrigatória antes da primeira gravação e auditoria: total bruto, taxas, líquido, por canal e por dia.
6. **Cruzamento só de leitura** com o extrato do Inter usando `receiptThreeWayMatch` (liquidação ↔ depósito), mostrando o que fechou e o que sobrou, linha a linha.
7. Depois de 1–2 semanas validado: ligar leitura diária agendada. Outras operadoras (Stone, PagBank, Getnet, Rede) entram como novos adaptadores na mesma estrutura. Envio à Olist só em plano separado.

## Fora do escopo

- Qualquer escrita na Olist, baixa, ou mudança em Inter/Olist.
- Limpeza dos 41 duplicados da Olist (segue pendente, com super admin).
- Criar receitas no Fluxo Bancário a partir de vendas.

# Integração Olist ERP (antigo Tiny): enviar lançamentos do Inter para a Olist

## Objetivo
Na WNC (e em outros clientes que a administração liberar), cada lançamento lido do Banco Inter é enviado automaticamente para a Olist ERP, na conta bancária correspondente de lá, com a categoria sugerida pela plataforma.

```text
Banco Inter --(leitura já existente)--> Plataforma --(categoria sugerida)--> Olist ERP
                                                     |
                                                     +-- dá baixa na conta em aberto da Olist
                                                     +-- se não achar, cria a conta já paga/recebida
```

## Como vai funcionar
1. **Liberar por empresa**: chave "Integração Olist", ligada só pela administração (super admin), igual ao Inter.
2. **Conectar**: a administração autoriza a conta da Olist da empresa (login da Olist, autorização única). As chaves ficam criptografadas e ninguém consegue lê-las depois.
3. **Ligar contas**: escolher qual conta bancária da Olist corresponde à conta Inter da plataforma e a data de início (nada antes dela é enviado).
4. **Categoria automática**:
   - procura no histórico da própria empresa lançamentos parecidos (mesma descrição/contraparte e mesmo sentido) e usa a categoria mais frequente;
   - mapeia a categoria da plataforma para a categoria da Olist (tabela "De/Para" editável pela equipe, criada com sugestões pelo nome);
   - sem correspondência segura: envia com a categoria **"A classificar"** na Olist e marca o lançamento aqui como pendente de classificação.
5. **Envio para a Olist (tudo automático)**:
   - procura conta a pagar/receber em aberto na Olist com mesmo valor, sentido e vencimento próximo (mesma janela do Meu Dia: até 7 dias antes e 3 depois);
   - achou exatamente uma: dá a baixa nela, na conta bancária ligada;
   - não achou (ou achou mais de uma): cria a conta já paga/recebida, para não baixar a errada;
   - Operações (transferências, aplicações) não viram receita nem despesa: vão como transferência/movimentação de caixa ou ficam de fora, conforme a regra que definirmos no De/Para.
6. **Sem duplicar**: cada lançamento guarda o código gerado na Olist; reenvios e novas leituras do Inter nunca criam outro.
7. **Acompanhamento**: na tela da conta, status de cada lançamento (Enviado / Baixado em conta existente / A classificar / Erro), botão "Reenviar" e aviso na carteira quando falhar, como já acontece com o Inter.
8. **Correção de categoria**: se a equipe reclassificar aqui um lançamento "A classificar", a plataforma atualiza a categoria na Olist e passa a usar esse exemplo nas próximas sugestões.

## Fora deste primeiro passo
- Trazer da Olist contas em aberto e vendas para a plataforma (planejado para depois).
- Nada da Olist altera os cálculos financeiros da plataforma: a SSOT continua igual.

## Antes de ligar na WNC
- A WNC precisa ter um usuário da Olist com acesso à API (plano da Olist que inclua API) e criar o aplicativo na Olist para a autorização.
- Piloto em modo teste: os primeiros dias rodam e mostram o que **seria** enviado; depois de conferido, liga-se o envio real.

## Detalhes técnicos
- API Olist ERP v3 (OAuth2 com refresh token). Endpoints: contas a pagar/receber (listar em aberto, criar, baixar), categorias de receita/despesa, contas financeiras.
- Tabelas novas (todas com RLS is_admin + RESTRICTIVE `can_see_school`): `erp_connections` (provider='olist', tokens `*_enc` sem SELECT, lidos só pela Edge Function via RPC service_role), `erp_account_links` (bank_account_id ↔ conta Olist, start_date, modo teste), `erp_category_map` (categoria/tipo da plataforma ↔ categoria Olist), `erp_push_log` (bank_transaction_id único, olist_id, ação, status, erro).
- Liberação por `school_features.olist_erp`.
- Edge Function `olist-sync`: ações connect/callback, save_link, save_map, push (lote), retry; agendada pelo mesmo pg_cron do Inter, rodando logo após cada leitura.
- Regras puras e testadas em `src/lib/erp/olistPush.ts`: sugestão de categoria por histórico, escolha baixa×criação (só baixa com candidato único), tratamento de Operação via `classificationUtils`/`tipoMeta` (nunca pelo sinal).
- Painel `OlistErpPanel` ao lado do `InterApiPanel`; avisos em `src/lib/teamAlerts.ts`.
- Regra registrada em `AGENTS.md`.

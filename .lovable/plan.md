# Quintal de Casa: Tiny (Olist), Inter e Asaas com lançamentos e baixas automáticas

## Situação hoje
- **Tiny/Olist** e **Banco Inter** já existem e rodam na WNC: o Inter é lido sozinho e cada lançamento vai para a Olist (Tiny), com categoria pelo histórico ou "A classificar", baixa automática quando há uma conta em aberto compatível.
- **Asaas** ainda não tem integração. Hoje só aparece como texto/forma de recebimento.
- A Quintal tem vários CNPJs: cada CNPJ pode ter sua conta Inter e sua conta Tiny.

## O que fazer
1. **Inter (sem programação nova):** em Contas bancárias da Quintal, cadastrar cada conta Inter com o certificado e as chaves do Inter de cada CNPJ (somente leitura). Definir a data de início; não duplica com extratos já importados.
2. **Tiny/Olist (sem programação nova):** no perfil da Quintal, autorizar o app da Olist (mesma URL de retorno da WNC), ligar cada conta Inter à conta financeira certa no Tiny. Começar em **modo teste** (prévia sem gravar), conferir, e só então ligar o envio automático.
3. **Asaas (programação nova, somente leitura):** criar o conector Asaas no mesmo padrão do Mercado Pago:
   - chave da API guardada criptografada, nunca visível;
   - lê cobranças pagas, taxas e repasses para a conta;
   - cruza com o Inter (repasse do Asaas = entrada no banco) para não contar duas vezes;
   - no Tiny, usa o pagamento do Asaas para dar **baixa na conta a receber** do cliente (cobrança com candidato único compatível); sem candidato, fica para conferência.
   - nunca cria cobranças nem movimenta dinheiro.
4. **Segurança na ativação:** primeiro dia só prévia; cuidado com a lição da WNC (não reenviar lançamentos que já estavam no Tiny) — a data de início no Tiny será posterior ao último lançamento já feito lá.

## O que preciso de vocês
- Lista dos CNPJs da Quintal que têm conta Inter e Tiny (um Tiny por CNPJ ou um só?).
- Por CNPJ: certificado/chaves do Inter e chave da API do Asaas (cadastradas por vocês na tela, não por chat).
- Data a partir da qual o sistema deve lançar no Tiny.

## Detalhes técnicos
- Reusa `inter-sync`, `olist-sync` (`erp_connections`, `erp_push_log`, `push.ts`) com `entity_id` por CNPJ.
- Novo: Edge Function `asaas-sync` (GET apenas), tabelas no padrão `acquirer_*` com RLS + RESTRICTIVE `can_see_school`, chave em coluna `*_enc` lida só por RPC service_role; regras puras testadas para cruzamento repasse×Inter e baixa no Tiny.
- Baixa de contas a receber no Tiny via `olist-sync` estendida (candidato único por valor/data/cliente), registrada em `erp_push_log`; nada altera cálculos da plataforma (SSOT intacta).
- Custo: nenhuma assinatura nova do nosso lado; Asaas e Inter não cobram pela API de leitura (confirmar no plano do cliente).

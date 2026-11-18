# Dourados: pendências no acesso do franqueado (entradas e saídas)

## O que muda
- Ligar a tela "Pendências" (com sininho e item no menu) para Dourados. O franqueado (gustavo@dourados.com) passa a ver.
- Em Dourados aparecem **todas** as pendências do banco: entradas e saídas. Salto continua só com saídas.
- A lista ganha uma coluna/selo "Entrada" ou "Saída" e um filtro "Todas / Entradas / Saídas" (só quando a empresa mostra as duas).
- O campo muda conforme o tipo: "Qual é essa despesa?" para saídas e "De onde veio essa entrada?" para entradas.
- O sininho conta as pendências sem resposta das duas.
- Para a equipe, nada muda: o balão "Cliente: …" e o filtro "Com resposta do cliente" no Fluxo Bancário valem também para entradas.
- A resposta continua sendo só um recado: não classifica, não concilia e não altera valores.

## Detalhes técnicos
- Nova chave por empresa `school_features.cliente_pendencias_entradas` (ligada só em Dourados), além de `cliente_pendencias_saidas` (ligar também em Dourados).
- Migration: `client_pending_outflows_enabled` passa a retornar true se qualquer chave estiver ligada; nova RPC `client_pending_settings(_school_id)` retorna quais tipos mostrar; `client_pending_outflows` inclui `tipo` e devolve entradas quando a chave de entradas estiver ligada (mesmas regras: pendente, movement_kind normal, não previsão, conta não virtual); `save_client_tx_note` aceita entrada quando a chave de entradas estiver ligada.
- Front: `ClientPendencias.tsx` e `src/lib/clientPending.ts` com tipo e filtro; teste novo para a regra de quais tipos aparecem e a contagem do sininho.
- Atualizar a regra no AGENTS.md.
- Testar com um cliente de teste em Dourados e apagar depois.

# Desfazer duplicados na Olist (WNC) e impedir que se repita

## O que aconteceu
O reenvio gravou 41 lançamentos no Caixa da conta Inter na Olist. Eles vão de 03/11 a 06/11 e somam R$ 142.415,99. A plataforma só olhava o próprio histórico de envios. Não conferia o que já estava lançado na Olist (feito pela equipe ou pelo extrato da própria Olist). Por isso, o que já existia lá foi lançado de novo.

## Passos
1. **Limpar os duplicados (só o que nós criamos):**
   - Para cada um dos 41, buscar na Olist um lançamento da mesma conta, no mesmo dia, mesmo sentido e mesmo valor, que **não** tenha sido criado por nós.
   - Se achar, apagar o nosso (pelo número que a Olist devolveu) e marcar como "Já existia na Olist".
   - Se não achar, manter o nosso, porque ele estava faltando lá.
   - Lançamentos feitos pela equipe na Olist nunca são apagados.
2. **Conferir antes de cada envio:** antes de lançar no Caixa, ler os lançamentos da conta na Olist naquele período. Se já existir um igual (mesmo dia, sentido e valor, com tolerância de 1 dia), não envia: só registra como "Já existia na Olist". Quando houver dois iguais no mesmo dia, cada lançamento da Olist só pode ser usado uma vez.
3. **Saldo Inter x Olist:**
   - Depois de cada envio, comparar o saldo do Inter, lido pela integração, com o saldo da conta bancária na Olist.
   - Mostrar no painel: "Saldo Inter R$ X · Saldo Olist R$ Y · diferença R$ Z".
   - Se houver diferença, pausar os envios automáticos e listar os dias que causaram a diferença (para cada dia: total Inter x total Olist).
4. **Novo status "Já existia na Olist"** na tabela do painel, para cada lançamento ficar explicado.
5. **Teste:** rodar a limpeza e conferir que a Olist volta a ter só um lançamento por movimento e que o saldo bate com o do Inter.

## Antes de rodar a limpeza
A limpeza vai apagar lançamentos na Olist. Por isso vou mostrar primeiro a lista do que seria apagado (modo teste). Só depois de você conferir é que ela apaga de verdade.

## Detalhes técnicos
- `erp_push_log` guarda `olist_id` dos 41 (status `a_classificar`, ação `caixa`).
- Leitura: `GET /caixa` filtrando por conta e data. Exclusão: `DELETE /caixa/{id}`, apenas para ids presentes em `erp_push_log.olist_id`.
- Nova ação `dedup_cleanup` em `olist-sync` (com simulação), pré-checagem dentro de `runPush`, status `ja_existia`. O saldo da Olist vem da listagem do Caixa ou de contas financeiras e é confirmado na API.
- As regras de pareamento ficam em `push.ts`, com testes.

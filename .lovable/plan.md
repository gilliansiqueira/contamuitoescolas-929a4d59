# WNC × Olist: por que 41 × 34 e por que tudo ficou "A classificar"

## O que os dados mostram (novembro, conta Inter)

- Plataforma: 41 lançamentos de 03/11 a 06/11 — 4 entradas (R$ 31.448,75) e 37 saídas (R$ 110.967,24).
- Olist (print): 34 lançamentos — entradas R$ 31.448,75 (iguais) e saídas R$ 109.280,27.
- Diferença: 7 saídas, total de R$ 1.686,97. São exatamente estas, que não aparecem na Olist:
  - 03/11 Expresso São Miguel R$ 881,92
  - 03/11 APB Indústria R$ 137,00
  - 04/11 Copel R$ 375,88 e R$ 111,27
  - 05/11 Lithium Software R$ 157,00
  - 06/11 M4 Produtos R$ 15,00
  - 06/11 Leal Pavan R$ 8,90
- Os lançamentos do print da Olist têm o texto "| INT2611..." — são os que a própria Olist trouxe do Inter, não os da nossa plataforma. Ou seja, os duplicados já saíram e faltam só esses 7 na Olist.
- O "42" não aparece nos dados de hoje; vou conferir de novo direto na Olist (passo 1).

## Por que ficou tudo "A classificar"

- Na Olist: a tabela De/Para (categoria da plataforma → categoria da Olist) da WNC está vazia, e não havia envios anteriores para aprender. Sem isso, a regra manda para "A classificar" de propósito, para não chutar categoria.
- Na plataforma: "Pendente" não quer dizer "sem categoria". Os 41 já têm categoria (ex.: Despesa); "Pendente / Sem justificativa" é a conciliação do dia, que ainda não foi finalizada.

## O que vou fazer

1. Conferir direto na Olist quais dos 41 lançamentos criados pela plataforma ainda existem e confirmar que faltam só os 7 acima (sem apagar nada).
2. Lançar na Olist só os 7 que faltam, com a mesma checagem para não duplicar. Depois rodar "Conferir com a Olist" e mostrar a diferença em R$ 0,00 e o saldo final igual ao do Inter.
3. No painel Olist, na aba "Contas e categorias", preencher o De/Para já com sugestões pelo nome das categorias da plataforma, para a equipe só confirmar e salvar.
4. Botão "Atualizar categorias na Olist": troca "A classificar" pela categoria do De/Para nos lançamentos que a plataforma criou. Os lançados pela equipe na Olist ficam como estão.
5. No painel, mostrar o total do mês dos dois lados (quantidade, entradas, saídas) e listar os lançamentos que existem só de um lado.

## Detalhes técnicos

- Passo 1: GET `/caixa` por conta/período e cruzar com `erp_push_log.olist_id`; marcar como `removido_na_olist` os que sumiram.
- Passo 2: reenvio só das linhas faltantes usando `findExisting` (mesmo dia ±1, sentido e valor).
- Passo 4: nova ação `recategorize` em `olist-sync` (PUT no lançamento do Caixa só quando `olist_id` vem do `erp_push_log`); regra pura em `push.ts` com teste em `src/test/olistPush.test.ts`.
- Nada altera os números da plataforma.

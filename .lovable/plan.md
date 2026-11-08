# WNC × Olist: 42 lançamentos, 34 "A classificar"

## Resposta (conferida nos dados)

**Por que 42 na Olist e 41 na plataforma**
- O 42º é o **Aluguel de 01/11 (Leonora Dadas de Oliveira, R$ 3.376,50)**. Ele existe só na Olist (origem "B", extrato importado lá). A leitura do Inter na plataforma não tem nenhum lançamento entre 31/10 e 02/11.
- Tirando o aluguel, os totais batem certinho: saídas na Olist R$ 114.343,74 − R$ 3.376,50 = **R$ 110.967,24**, igual à plataforma. Entradas: R$ 31.448,75 nos dois.

**Por que só 34 "A classificar" e não 42**
- 8 já têm categoria na Olist: o Aluguel e 7 saídas que a equipe classificou lá (aparecem com competência 11/2026):
  - APB Etiquetas R$ 137,00 (Etiquetas)
  - Expresso São Miguel R$ 881,92 (Frete Produtos)
  - Copel R$ 375,88 e R$ 111,27
  - Lithium Software R$ 157,00
  - M4 Produtos R$ 15,00
  - Leal Pavan R$ 8,90
- Os outros 34 vieram "A classificar" porque a tabela De/Para (categoria da plataforma → categoria da Olist) da WNC está vazia. Sem ela, a integração não arrisca categoria.

**Por que na plataforma os 41 aparecem "Pendentes"**
- Não é falta de categoria: todos têm categoria (ex.: Despesa). "Pendente / Sem justificativa" é a conciliação do dia, que ainda não foi finalizada.

## O que proponho fazer

1. Conferir por que o Aluguel de 01/11 não veio na leitura do Inter (dia sem movimento na API, agendamento ou lançamento manual na Olist) e, se for movimento real do banco, trazê-lo para a plataforma.
2. No painel Olist, preencher o De/Para com sugestões: pelo nome da categoria e pelo que a equipe já classificou na Olist (ex.: Expresso São Miguel → Frete Produtos). A equipe só confirma e salva.
3. Botão "Atualizar categorias na Olist": troca "A classificar" pela categoria do De/Para só nos lançamentos que a plataforma criou. O que a equipe já classificou na Olist não é tocado.
4. No painel, resumo do mês dos dois lados (quantidade, entradas, saídas, quantos "A classificar") e lista do que existe só de um lado — assim o caso do Aluguel aparece sozinho.

5. **Volta da Olist → plataforma (novo):** em cada envio e de 2 em 2 horas, a plataforma lê a categoria de cada lançamento na Olist.
   - Lançamento com categoria (não "A classificar") e com essa categoria no De/Para: a plataforma aplica o item do modelo correspondente e marca como **Conciliado** (origem "Olist").
   - Se a equipe trocar a categoria na Olist depois, a plataforma atualiza o item aqui, mas só enquanto o mês não estiver fechado e a conciliação não tiver sido feita à mão na plataforma (o que a equipe faz aqui vale mais).
   - Categoria da Olist sem par no De/Para: continua Pendente, com o aviso "Categoria da Olist sem De/Para".
   - Nunca altera valor, data nem saldo, só a classificação e a conciliação.

## Detalhes técnicos

- Passo 2: ler categorias dos lançamentos do Caixa da Olist (GET `/caixa`) e sugerir por descrição normalizada + sentido; gravar em `erp_category_map` só após confirmação.
- Passo 3: nova ação `recategorize` em `olist-sync`, PUT apenas em `olist_id` presentes em `erp_push_log` com categoria "A classificar"; regra pura em `push.ts` com teste em `src/test/olistPush.test.ts`.
- Passo 5: nova ação `pull_categories` em `olist-sync` (também no cron), que cruza o `olist_id`/lançamento correspondente e usa o De/Para invertido → `model_item_id`. Grava `recon_source='olist'` e marca conciliado. Respeita `is_month_closed` e não sobrescreve conciliação manual. Fica registrado em `erp_push_log` (categoria da Olist e quando foi lida).
- Passos 1–4 não alteram números. O passo 5 só muda a classificação, que passa pela SSOT (`tipoMeta`/`ledgerEngine`) como qualquer classificação manual.

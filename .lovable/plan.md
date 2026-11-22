# WNC: categorias no Tiny e "repasse do Mercado Pago" no Pix do Inter

## 1. Categorias: voltar ao jeito anterior
**O que mudou:** até 14/11, a categoria de cada lançamento era copiada dos lançamentos do **Caixa do Tiny** que tinham o mesmo nome (inclusive os que a equipe corrigiu lá). A partir de 15/11, ela passou a vir das **contas pagas** do mesmo fornecedor, olhando só as 5 últimas. Desde essa mudança, a parte enviada como "A classificar" subiu: de 8 a 14/11 foram 21 de 49 (43%); em 18 e 19/11, foram 25 de 37 (68%).

**O que vou fazer:**
- Voltar à regra antiga: categoria pelo Caixa do Tiny (12 meses), olhando o mesmo nome e uma categoria que se repete em pelo menos 60% dos casos.
- Ficam valendo duas proteções que vieram depois e não pioram nada:
  - nunca trocar uma categoria que a equipe já escolheu no Tiny;
  - a separação da folha de outubro continua como foi lançada.
- Rodar de novo só nos lançamentos que estão como "A classificar" (hoje 50 saídas e 16 entradas). Os que já têm categoria não mudam.
- Mandar uma planilha com o que recebeu categoria e o que continuou "A classificar".

## 2. Pix "repasse do Mercado Pago"
**O que vi:** até o fim de outubro, os extratos da WNC vinham por arquivo, e a linha do Pix trazia o código do banco de quem pagou, por exemplo: `Pix recebido: "Cp :10573521-WNC GROUP..."`. O número 10573521 é o código do Mercado Pago. Era por ele que dava para saber que se tratava de um repasse. Desde novembro, o extrato chega direto do Inter, e a descrição vem só como `Pix recebido - Wnc Group Vestuario E Servicos Ltda`, sem o banco. Por isso o repasse parece um Pix da própria WNC.

**O que vou fazer:**
- Conferir se a leitura do Inter traz, nos detalhes do Pix, o banco de quem pagou. A leitura atual usa só o título e a descrição. Isso ainda não está confirmado.
- Se trouxer: quando o banco for o Mercado Pago, a descrição passa a terminar com " (via Mercado Pago)". A correção vale para os próximos lançamentos e também para os de novembro, que serão corrigidos pela descrição editada, sem apagar nada.
- Se não trouxer: aviso você, e a alternativa é cruzar com os repasses lidos na conta do Mercado Pago (mesmo dia e valor), se essa conexão estiver ativa para a WNC.

Nada disso muda valores nem cálculos. Muda só o nome do lançamento e a categoria no Tiny.

## Detalhes técnicos
- `olist-sync/index.ts`: o `histCategory` (que lê o detalhe de `/contas-pagar` pagas) volta a ser o `suggestOlistCategory` sobre o `listCaixa` de 12 meses, filtrando o pendCat, como no commit df05baf1. Mantêm-se o `setCaixaCategoria`, que não sobrescreve, e a ação `ops`. Rodar uma vez com `retry`.
- `inter-sync/mapping.ts`: ler `detalhes` (campos do banco do pagador) do `/extrato/completo`, que hoje é ignorado. Antes, inspecionar o payload numa leitura. Banco Mercado Pago = ISPB 10573521 / código 323. Teste em `src/test/interSync.test.ts`.

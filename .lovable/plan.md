# WNC: puxar a categoria do Tiny pelo histórico

## O que vi
- Hoje há **70 lançamentos da WNC enviados ao Tiny como "A classificar"** (57 saídas e 13 entradas).
- Exemplo: o Pix de R$ 8.773,04 para Iolanda Gadonski Ferreira (13/11). Ela já recebeu 9 Pix em setembro e outubro.
- Na plataforma, o modelo da WNC só tem "Despesa" e "Receita". Por isso a categoria certa precisa vir do que a equipe já escolheu no Tiny.

## Por que não puxou (provável)
1. Para sugerir, a plataforma olha o histórico do Tiny, mas **ignora tudo o que ela mesma enviou**. Quando a equipe reclassifica no Tiny um lançamento que a plataforma enviou (como os Pix antigos da Iolanda), essa escolha não é aproveitada.
2. Os 70 lançamentos que já estão "A classificar" **nunca são revistos** pelo histórico. Só são revistos se alguém mudar o item na plataforma.
3. O histórico olhado é de só 180 dias.

Não consigo ler o Tiny daqui, então a causa 1 ainda precisa ser confirmada. Ela é o primeiro passo da execução.

## O que vou fazer
1. **Confirmar no Tiny** com uma sincronização de teste: ver qual categoria os Pix antigos da Iolanda têm lá hoje.
2. **Aproveitar as reclassificações da equipe:** lançamentos enviados pela plataforma e depois classificados no Tiny passam a contar como histórico. "A classificar" continua não contando.
3. **Rever os pendentes:** a cada sincronização, os lançamentos "A classificar" da WNC buscam a categoria no histórico. Se uma categoria aparecer em pelo menos 60% dos lançamentos da mesma pessoa e do mesmo sentido, a plataforma atualiza o lançamento no Tiny. Se não, ele continua "A classificar".
4. **Olhar 12 meses de histórico** em vez de 6.
5. Rodar a sincronização da WNC e trazer a lista: o que foi classificado e o que continua pendente, com o motivo.

Nada muda nos números da plataforma: isso só mexe na categoria lá no Tiny.

## Detalhes técnicos
- `supabase/functions/olist-sync/index.ts`: em `catHist`, deixar de filtrar `ours` e descartar só entradas sem categoria ou com `pending_categoria_id`. No passo 1 (reclassificação), quando `catOf` não resolver, usar `suggestOlistCategory(descricao, tipo, catHist)` e fazer o PUT `/caixa/{id}` com `categoria_origem='historico_olist'`. Janela de 180 para 365 dias.
- `push.ts` sem mudar a regra dos 60%. Novo teste em `src/test/olistPush.test.ts` com "Pix enviado: \"Cp :81466286-Iolanda…\"" contra "Pix enviado - Iolanda…" e a categoria pendente ignorada.
- Publicar `olist-sync` e rodar a sincronização da WNC.

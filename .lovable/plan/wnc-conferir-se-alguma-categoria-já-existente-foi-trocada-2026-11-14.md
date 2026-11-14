# WNC: conferir se alguma categoria já existente foi trocada

## O que já foi conferido
- Não tirei a categoria de nada. A troca automática pelo histórico só mexe nos lançamentos que a própria integração enviou ao Tiny como "A classificar" (o Pix do banco que não tinha categoria). Lançamentos feitos pela equipe no Tiny nunca entram nessa troca.
- Antes de hoje já eram **71 em "A classificar"**, todos enviados pela integração entre 08/11 e 14/11. Hoje **32 deles ganharam categoria** pelo histórico e **39 continuam** como estavam. Nenhum lançamento saiu de uma categoria e foi para "A classificar".
- A única mudança em lançamentos que já tinham categoria foi a separação da folha de 04/11, que você pediu: 8 Pix de salário. A Gabriella já estava em "Salário Auxiliar de Ecommerce" e continua igual. Nos outros 7, gravei a categoria de salário das contas a pagar de cada pessoa. A categoria anterior desses 7 não ficou registrada.

## O que vou fazer
1. Ler agora no Tiny os 8 Pix da folha e os 32 reclassificados. Montar uma lista "antes → depois" para mostrar que os 32 eram "A classificar" e qual categoria cada Pix da folha tem agora.
2. Se algum Pix da folha estiver numa categoria de salário diferente da que a equipe usa, devolver para a categoria certa. Se você preferir, desfaço também a divisão em salário/VT/VR.
3. Ajustar a regra para nunca regravar por cima de uma categoria que já existe no Tiny: antes de trocar, ler o lançamento e só seguir se ele ainda estiver em "A classificar". Isso protege o caso em que a equipe classifica à mão antes da sincronização.
4. Colocar essa lista "antes → depois" numa aba da planilha de conferência da WNC (já aprovada) e entregá-la junto com o resumo da Stone.

## Detalhes técnicos
- Em `setCaixaCategoria` / passo 1 do `runPush`, o GET já é feito: abortar quando `c.categoria.id !== pending_categoria_id` e marcar o log como `enviado` com `categoria_origem='equipe'`.
- A conferência usa só leitura (`ops get`) e o `erp_push_log`.

# WNC × Inter × Olist: buraco do dia 01/11 e categorias

## O que encontrei

- Você tem razão: a saída de **R$ 3.376,50 da Leonora em 01/11** existe no Inter. A plataforma não pegou porque a primeira leitura do Inter (08/11) buscou só **os últimos 7 dias, de 02/11 a 08/11**. O último extrato OFX ia até 30/10. Por isso **31/10 e 01/11 ficaram sem leitura**.
- O mesmo aluguel aparece em 02/09 e 01/10 (vindos do OFX), então é mensal. Faltar em novembro foi falha nossa, não do banco.
- Tirando esse aluguel, banco e Olist batem: entradas R$ 31.448,75 e saídas R$ 110.967,24 dos dois lados.

## O que vou fazer

1. **Fechar o buraco agora:** reler o Inter de 31/10 a 08/11 na WNC. O aluguel de 01/11 entra; o que já existe não duplica. Na Olist ele não é lançado de novo, porque a checagem já encontra o aluguel que vocês lançaram lá.
2. **Não deixar acontecer de novo (todas as empresas com Inter):** cada leitura começa no dia seguinte ao último extrato da conta (OFX, PDF ou leitura anterior), e não só nos "últimos 7 dias". O limite é a data de início da integração e no máximo 90 dias por vez. Se a leitura já começar antes, nada muda.
3. **Categorias, sem De/Para:** na plataforma valem só as classificações da lista (Entrada, Saída, Operação, Ignorar, Transferência entre contas, Resgate automático). Para a Olist, a categoria continua sendo escolhida automaticamente: a mais usada em lançamentos parecidos já classificados lá. Se não houver nenhum parecido, vai "A classificar". A tela de De/Para sai do caminho e fica só como ajuste opcional.
4. Conferir com você: depois do passo 1, a plataforma mostra 42 lançamentos em novembro, igual à Olist, e a diferença no "Conferir com a Olist" fica em R$ 0,00.

Fica para depois, se você quiser: a volta da Olist para a plataforma (conciliar aqui quando a categoria estiver certa lá).

## Detalhes técnicos

- Passo 1: chamar `inter-sync` ação `sync` com período de 31/10 a 08/11 (o dedup `dedup_hash`/`bank_ref` evita duplicar) e depois `olist-sync` push (o `findExisting` encontra o Aluguel da Olist e grava `ja_existia`).
- Passo 2: em `inter-sync`, `from = max(start_date, min(hoje-7, último data da conta + 1))`, com no máximo 90 dias. A regra pura vai para o módulo de período, com teste em `src/test/interSync.test.ts` (caso: OFX até 30/10, leitura em 08/11, a leitura começa em 31/10).
- Passo 3: em `push.ts`, a sugestão por histórico também usa os lançamentos do Caixa da Olist já categorizados pela equipe (descrição normalizada + sentido), além do `erp_push_log`. Teste em `olistPush.test.ts`.
- Nada altera a SSOT; o lançamento novo segue o fluxo normal do extrato.

# Cuiabá (boleto duplicado) e Portão (Stone)

## 1. Cuiabá Goiabeiras: boleto de 28/09 contado duas vezes
**O que aconteceu:** o extrato do BB baixado em 28/09 mostrava a "624 Cobrança" com um valor provisório de **R$ 489,13**. No extrato de 29/09 (e no PDF enviado), o banco fechou o mesmo recebimento em **R$ 491,40**. O sistema entendeu os dois como recebimentos diferentes, porque o BB não manda um código único para esse lançamento.

Hoje a linha de R$ 489,13 está como "Ignorar". Isso tira ela de Receita e Resultado, mas **ela continua somando no saldo**. Por isso fica duplicado no fluxo.

**O que vou fazer:**
- **Agora:** apagar a linha de R$ 489,13 de 28/09. A de R$ 491,40, que já está conciliada, fica como está. A exclusão fica registrada no histórico.
- **Para a equipe resolver sozinha nas próximas vezes:** criar a opção **"Excluir lançamento"** no menu (⋯) da linha em Movimentações. Ela terá estas regras:
  - só aparece para administradores;
  - pede confirmação e um motivo;
  - não deixa excluir lançamento já conciliado nem de mês fechado;
  - grava quem excluiu, quando, o valor e o motivo no histórico;
  - depois de excluir, recalcula o fluxo.

## 2. Portão: Stone
**O que já sei:** o arquivo da Stone informa **R$ 1.523,45** em 29/09, e isso bate com o extrato: em 28/09 a conta zerou com o Pix de R$ 27.831,89 para o Sicredi e em 29/09 entrou R$ 1.523,45. O sistema, porém, calcula **R$ 4.141,53**, ou seja, **R$ 2.618,08 a mais**, vindos de antes de 28/09.

**O que vou fazer:**
1. Refazer o saldo da Stone dia a dia desde 01/09 e achar as linhas exatas dos R$ 2.618,08: duplicadas, que sobraram de algum extrato anterior (como aconteceu no BB de Cuiabá) ou com sentido trocado.
2. Corrigir essas linhas, com registro no histórico.
3. Conferir se o Itaú fica "a confirmar" (R$ 16,06, dentro do novo limite de R$ 20) e se o botão "Aprovar e ativar" libera.
4. Te mostrar as linhas responsáveis antes de publicar.

## Detalhes técnicos
- Cuiabá: excluir `bank_transactions` id `07f2db9f…` (R$ 489,13, `movement_kind=ignorar`, pendente) via run_sql, com `audit_log` `bank_tx_excluida`. Depois rodar `sync_bank_cashflow_school`.
- Nova ação no menu da linha em BankTransactionsTable (admin): primeiro confirmar como o trigger `guard_bank_tx_immutable` trata DELETE. Se ele bloquear, criar a RPC security definer `delete_bank_tx(_tx_id, _motivo)`, que valida admin, status pendente e mês aberto, remove as divisões (splits), grava `audit_log` e ressincroniza.
- Portão Stone: conta `306f9768…`. Imports 28/09 e 29/09 com saldos informados 27.831,89 e 1.523,45. Auditar o saldo acumulado por dia contra os saldos dos extratos.

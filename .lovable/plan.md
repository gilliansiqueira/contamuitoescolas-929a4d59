# Lista "empresas que vão ficar com saldo negativo"

## Como a lista funciona hoje
- Ela não é guardada em lugar nenhum. É calculada na hora em que o painel abre e refeita no máximo a cada 10 minutos. Sem "Fluxo Bancário" ativo e sem saldo de extrato, a empresa não entra na lista.
- **Ponto de partida:** o saldo do último extrato de cada conta, somado. Usa a data mais recente entre as contas, mesmo quando uma conta está alguns dias atrasada.
- **O que soma depois:** os recebimentos e as contas a pagar da projeção, dia a dia, até 15 dias à frente. Os valores vêm das mesmas regras oficiais da projeção.
- **O que mostra:** o primeiro dia em que o saldo fica negativo e o menor saldo do período.

## Por que Manaus deu -R$ 76.754,85
O cálculo foi refeito com os dados reais:
- O último extrato do Bradesco foi enviado em 03/11, mas está registrado como indo **até 04/11**, com saldo de R$ 6.260,36. A Stone está em R$ 656,04 (29/10). Ponto de partida: cerca de R$ 6.916.
- Como a lista considera que o saldo já é do dia 04/11, ela **pula os recebimentos previstos para 04/11 (R$ 18.600,43)**. O extrato só tinha R$ 305,58 desse dia, porque o dia ainda não tinha acontecido.
- Em 05/11 entram R$ 12.544,69 e saem R$ 96.215,94 de contas a pagar. Conta: 6.916 + 12.545 − 96.216 = **−76.755**.
- Com 04/11 tratado como previsão, o menor saldo seria em torno de **−R$ 58.155**. Continua negativo por causa das contas de 05/11, mas bem menos. Se a tela de Manaus mostra um valor ainda menor, comparo as duas no passo 3.

O mesmo erro acontece em qualquer empresa cujo extrato termine numa data futura, ou que tenha uma conta com extrato atrasado.

## O que corrigir
1. O saldo de partida nunca passa de hoje. Movimentos do extrato com data futura contam como previsão e não apagam os recebimentos projetados daquele dia (regra que já existe no motor mensal).
2. Cada conta entra com o próprio saldo na própria data. Uma conta atrasada passa a somar também a projeção dos dias que faltam, em vez de ficar "congelada".
3. Conferir Manaus, Boa Vista e Sinop: o valor da lista igual ao Fluxo Diário de cada empresa no mesmo dia. Se ainda houver diferença, mostrar as linhas responsáveis.
4. Deixar claro no painel de onde vem o número: "a partir do extrato de dd/mm, saldo R$ X" e o horário da última atualização, com botão "Atualizar".
5. Teste automático com o caso de Manaus: extrato até 04/11 enviado em 03/11 não pode pular os recebimentos de 04/11.

## Detalhes técnicos
- `src/hooks/useMyDay.ts` → `computeSchool`: base = `confirmedBankBalance(..., { allowStaleSporadic: true })`; soma `projected` com `dataProjetada > base.date` até hoje+15.
- Corrigir: cortar `base.date` em `min(base.date, ontem/hoje)` considerando `periodo_fim` futuro, e somar a projeção por conta a partir da âncora de cada conta. De preferência, reaproveitar a função do Fluxo Diário (SSOT) em vez de manter um cálculo paralelo.
- Teste em `src/test/` para a regra da âncora futura.

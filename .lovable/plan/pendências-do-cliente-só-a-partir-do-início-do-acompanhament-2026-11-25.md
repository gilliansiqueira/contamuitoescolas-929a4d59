# Pendências do cliente só a partir do início do acompanhamento

## O que está acontecendo
O acompanhamento de Dourados começa em **setembro/2026**, e por isso a tela da equipe esconde o que vem antes. Mas ficaram gravadas **200 pendências de agosto**, que vieram de dois extratos com dias anteriores ao início:
- Stone: 198 lançamentos (R$ 137.653,86), do extrato enviado em 16/11.
- Bradesco: 2 lançamentos (R$ 2.975,40), do extrato enviado em 30/09.

A tela de pendências do cliente não aplica esse corte de início. Por isso ele vê agosto, e a equipe vê só as 5 de novembro.

## O que vou fazer
1. Fazer a tela de pendências do cliente seguir o mesmo início de acompanhamento da equipe. Vale para todas as escolas com pendências liberadas (Salto, Dourados, São Carlos e as duas de Uberlândia), e cada escola usa o seu próprio mês de início.
2. Conferir que Dourados passa a mostrar só as 5 de novembro: BB 3, Sicredi 1 e Stone 1.

Não apago nenhum lançamento, e nada muda em valores, saldos ou conciliação. Se você preferir apagar as 200 pendências de agosto, como fizemos em Manaus Centro e Praia da Costa, é só dizer.

## Detalhes técnicos
- Migration: `client_pending_outflows` (e o contador do sininho, se tiver um filtro separado) passa a filtrar `t.data >= start_month` de `school_data_sources`. Se a escola não tiver mês de início, nada é filtrado.

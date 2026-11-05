# São Carlos — saídas previstas de 01 a 08/10 e duplicidade de hoje

## O que os dados mostram
- **01 a 08/10 nunca tiveram contas a pagar previstas gravadas.** O envio de 02/09 ia até 30/09 e o de 09/10 foi gravado a partir de 09/10 (substituindo a partir dessa data). Por isso a coluna "Saída Prevista" fica vazia até o dia 8 — não foi o envio de hoje que apagou.
- **O envio de hoje (05/11) duplicou contas.** Ele trouxe contas a partir de 30/10, mas as do envio de 09/10 continuam no mesmo intervalo:
  - 30/10: 3 contas novas (R$ 1.860,99) somadas às 31 antigas (R$ 17.520,87) — as 3 antigas equivalentes ficaram duplicadas (Apoema 950, Puragua 300, Telebayte 610,99, vencidas 01/11 e antecipadas para sexta).
  - 03/11: VIVO R$ 74 aparece duas vezes.
- O relatório do Omni enviado (1.070 linhas, a partir de 01/11) é o mesmo que já foi gravado hoje.

## O que vou fazer
1. **Tirar a duplicidade de 30/10 e 03/11**: remover do envio de 09/10 só as contas que o envio de hoje repete (mesmo vencimento, valor e descrição), com registro no histórico. Nada mais muda.
2. **Corrigir a regra de substituição do Contas a Pagar**: quando o arquivo traz contas vencidas antes da data escolhida (antecipadas por fim de semana), a substituição passa a começar na primeira data realmente gravada, para não coexistirem dois envios. Teste automático para esse caso.
3. **01 a 08/10**: preciso do relatório de contas a pagar de outubro (vencimentos de 01 a 08/10) do Omni para gravar como previsto desse intervalo, substituindo só esses dias. Sem ele, a análise de outubro segue sem previsão nesses 8 dias.

## Pergunta
Você tem o relatório "A pagar" do Omni com vencimentos de 01 a 08/10? Se preferir, posso usar as saídas realizadas desses dias como previsão — mas isso deixa previsto = realizado e esconde diferenças na análise.

## Detalhes técnicos
- Limpeza via exclusão pontual em `financial_entries` (origem `contas_pagar`, imported_at 2026-10-09, datas 30/10 e 03/11, casadas por valor/descrição) + `audit_log`.
- Ajuste na rotina de substituição por data do upload de contas a pagar (usar `min(data)` gravada vs. data escolhida) e teste em `src/test/`.

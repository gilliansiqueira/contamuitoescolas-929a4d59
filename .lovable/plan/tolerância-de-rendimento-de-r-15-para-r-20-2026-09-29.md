# Tolerância de rendimento: de R$ 15 para R$ 20

## O que conferi no Portão
- **Itaú:** a diferença é de **R$ 16,06**, a mesma em 28/09 e em 29/09. Ela vem do rendimento da aplicação automática ("Aplic Aut Mais"), que não aparece como lançamento no extrato. Como passa de R$ 15, bloqueia a aprovação.
- **Sicredi:** confere em 29/09.
- **Stone:** o saldo de 29/09 informado pelo arquivo (R$ 1.523,45) é igual ao único recebimento do dia. Isso indica que o arquivo não traz o saldo real da conta. O caso é outro, sem relação com rendimento. Vou abrir a tela para confirmar e depois te conto separadamente.

## O que muda
- Diferenças de até **R$ 20,00** por conta deixam de bloquear o "Aprovar e ativar". Elas aparecem em amarelo como "A confirmar no próximo extrato", do mesmo jeito que hoje.
- Vale para todas as empresas.
- Nenhum lançamento, saldo ou relatório é alterado.

## Passos
1. Trocar o limite de R$ 15 para R$ 20 no ponto único onde ele é definido. Tela de conferência, Dashboard e Fluxo Diário leem esse mesmo valor.
2. Ajustar os testes que conferem o limite.
3. Abrir o Portão na prévia e confirmar que o Itaú aparece "a confirmar" e não bloqueia mais. Conferir também o que acontece com a Stone.
4. Publicar no site oficial.

## Atenção
Se o rendimento do Itaú nunca for lançado, a diferença pode crescer mês a mês e passar de R$ 20 de novo.

## Detalhes técnicos
- `BANK_SMALL_DIFF_TOLERANCE` em `src/lib/bankStatements/confirmedBalance.ts`: 15 → 20. Procurar com rg outros usos e textos fixos com "15".
- Testes: `src/test/confirmedBalance.test.ts` e outros que citam a tolerância.

# São Carlos: liberar a ativação com cheques retidos + centavos de rendimento

## O que foi confirmado (conta por conta)
```text
Diferença mostrada na tela                          15.430,04
Inter Matriz - saldo bloqueado (cheques) no PDF     15.433,90  (bate exato com as linhas)
Restante nas outras contas                              -3,86
```
- **Inter Matriz:** a diferença é exatamente o saldo bloqueado impresso no extrato (R$ 15.433,90).
- **Os R$ 3,86:** não estão no Inter. Estão nas outras contas, muito provavelmente no **Banco do Brasil**: o rendimento do BB Rende Fácil (R$ 2.883,25 no fim do dia 28/09) cresce sem aparecer como linha no extrato.
- **Por que não libera hoje:** o botão só libera quando a diferença é exatamente zero. Com os R$ 15.433,90, sobram R$ 3,86 e o botão continua bloqueado.
- **Observação:** o extrato do Inter que está no sistema foi enviado às 11h51. Ele ainda não tem os dois Pix de R$ 120,00 da Giovana, recebidos em 28/09. Esses Pix não entram na diferença, mas vão chegar no próximo extrato.

## O que vou fazer
1. **Confirmar os R$ 3,86 conta por conta:** mostrar, na Prévia da ativação, o saldo calculado ao lado do saldo do banco em cada conta. Assim a diferença de cada conta fica visível, sem ninguém precisar adivinhar.
2. **Aceitar diferenças pequenas:** seguindo a regra que já existe, uma diferença de até R$ 10,00 que sobrar depois dos cheques retidos vai para "A confirmar no próximo extrato", com o valor e a conta. O botão **Aprovar e ativar** passa a liberar nesse caso. Diferenças maiores continuam bloqueando.
3. **Em São Carlos, depois disso:** digite **15.433,90** na Inter Matriz e clique em Salvar. A prévia vai mostrar "R$ 3,86 a confirmar no próximo extrato (Banco do Brasil)", e a ativação fica liberada.

## Regras preservadas
- Nenhum lançamento, saldo ou histórico é alterado ou apagado.
- O valor retido continua registrado no Histórico de Alterações.

## Detalhes técnicos
- `ActivationPreview.tsx`: tabela por conta (calculado × âncora × retido) usando as âncoras já retornadas por `useBankAccounts`.
- Tolerância `SMALL_DIFF_TOLERANCE = 10` no gate de ativação: `|diff após retido| <= 10` gera o aviso "A confirmar no próximo extrato" e não bloqueia. Sem migration.

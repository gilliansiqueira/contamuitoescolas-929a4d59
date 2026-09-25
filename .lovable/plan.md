# Saldo conferido automático, pelo próprio extrato

## Explicação simples
Cada extrato que vocês sobem já informa o saldo do banco no último dia do arquivo:
- **Banco do Brasil**: traz o saldo em conta (−R$ 190,53) e o saldo com aplicação (R$ 148.992,18).
- **Sicredi**: traz só o saldo em conta (−R$ 289,41). O arquivo não informa o saldo aplicado.

O sistema já lia esses números, mas só para mostrar "confere" ou "diferença". Ele não os usava para corrigir o saldo. Por isso criei o botão "Informar saldo conferido", mas vocês têm razão: é trabalho manual e dá margem para erro.

## O que vai mudar
1. **O saldo do extrato passa a valer automaticamente.** Ao subir um extrato, o saldo que o banco informa no último dia vira o saldo oficial da conta naquela data. Ninguém precisa digitar nada.
2. **Aplicação automática (BB, Sicredi etc.):**
   - Se o extrato informa o saldo com aplicação (BB), o sistema usa esse total direto do banco.
   - Se o extrato não informa (Sicredi), o sistema mantém o total calculado pelos lançamentos. Quando a conta fica negativa, ele considera que o próprio banco cobre esse valor com a aplicação. Assim, o total não muda e a conta não aparece negativa.
3. **Diferenças não travam nada, mas ficam registradas.** Se o saldo do extrato for diferente do calculado (centavos de rendimento, resgate ou rendimento que não veio como linha), o saldo do banco prevalece. O Dashboard e o Fluxo Diário continuam atualizando normalmente. A diferença fica numa lista "A confirmar no próximo extrato", com conta, data e valor, visível só para a equipe. Quando o próximo extrato chegar e o saldo bater, o item some sozinho. Se continuar diferente, ele segue na lista. Nenhum lançamento é alterado.
   - Normalmente o extrato bate. Essas diferenças acontecem quase só em contas com aplicação automática, porque alguns bancos (como o Sicredi) não mandam no arquivo o saldo aplicado nem o rendimento do dia.
4. **O botão "Informar saldo conferido" sai da tela.** Os dois saldos que eu digitei à mão para Dourados são removidos e trocados pelos saldos que vêm dos arquivos.
5. As mensagens em vermelho de "em conta: diferença" deixam de aparecer quando a diferença for só a conta negativa coberta pela aplicação.

## Um ponto para confirmar
No Sicredi, o arquivo não traz o saldo aplicado. Pelo cálculo automático, o total fica em **R$ 617,96**, contra os R$ 618,38 que vocês viram no banco. Os R$ 0,42 de diferença são provavelmente rendimento do dia, que ainda não veio no extrato. Ele entra sozinho quando aparecer em um extrato seguinte.

## Detalhes técnicos
- Ao importar um extrato, gravar em bank_account_balances (origem 'extrato', data = periodo_fim) os campos saldo_conta = saldo_final_informado e saldo_aplicado = saldo_aplicado_informado − saldo_final_informado, quando existirem. Fazer também um preenchimento retroativo a partir de bank_statement_imports, somente para datas a partir de 01/09/2026.
- accountBalances passa a usar as âncoras das origens 'extrato' e 'conferencia'. Contas com aplicação automática e sem saldo aplicado informado: total = calculado, com emConta = max(emConta, 0) e o negativo descontado do aplicado.
- Remover BalanceAnchorControl da tela e apagar as 2 âncoras manuais de Dourados.
- Rótulo da Conferência: "Ajuste pelo saldo do extrato".

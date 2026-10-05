## 1. Simulação: tirar a explicação da receita
Na Consolidação Mensal, remover a linha pequena "R$ X recebidos · R$ Y a receber" abaixo da Receita (realizado + previsto). O valor continua o mesmo; o detalhe fica no Fluxo Diário.

## 2. Bairro Alto – Banco do Brasil não atualiza o saldo

**O que encontrei**
- O extrato novo (01/09 a 01/10) foi lido certo: os 5 lançamentos estão no sistema e somam exatamente zero (Pix 7.500,00 entra; Pronampe 6.018,02, tarifa 93,10 e aplicação Rende Fácil 1.481,98 saem; resgate 93,10 entra). Saldo impresso em 01/10: R$ 0,00.
- A conta está marcada como "com aplicação automática" (Rende Fácil). Para esse tipo de conta, o sistema só aceita o saldo do extrato se o arquivo também trouxer o valor aplicado. O PDF do BB não traz, então o saldo zero de 01/10 foi ignorado.
- Por isso continua valendo o saldo do extrato anterior (29/09), R$ 4.862,01, que na época foi lido como saldo total.

**Correção**
- Quando um extrato de conta com aplicação automática trouxer o saldo em conta mas não o aplicado, usar mesmo assim o saldo em conta impresso (R$ 0,00 em 01/10) como oficial, e manter o aplicado calculado (último aplicado conhecido + aplicações − resgates automáticos do período).
- "Atualizada até" passa a mostrar 01/10/2026 para o BB.
- Vale para todas as empresas com aplicação automática, não só Bairro Alto.
- Se o aplicado calculado do BB ficar estranho, o botão já existente de "informar saldo aplicado" no extrato continua servindo para corrigir manualmente.

**Conferência**
Abrir o Fluxo Bancário de Bairro Alto (set/2026) e confirmar Banco do Brasil: em conta R$ 0,00, atualizada até 01/10/2026, e o consolidado reduzido de acordo.

### Detalhes técnicos
- `src/hooks/useBankPilot.ts`: a linha `if (a.has_auto_invest && i.saldo_aplicado_informado == null) continue;` descarta a âncora. Trocar por âncora com `saldo_conta` informado e `saldo_aplicado` derivado da âncora anterior ajustada pelos lançamentos que casam com `bank_auto_invest_patterns` entre as duas datas (ou marcar aplicado como "calculado" para o motor seguir usando o próprio cálculo).
- Simulação: remover a nota de recebidos/a receber no componente da Consolidação Mensal.
- Nenhuma alteração de dados no banco.

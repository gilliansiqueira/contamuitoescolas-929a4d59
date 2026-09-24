# Transferências sem par em Dourados (e prevenção nas outras empresas)

## Causa confirmada nos dados
As 18 "Transferências sem par" de Dourados têm par de verdade. O que aconteceu:
- Na primeira importação, o sistema pareou as entradas da Inter ("Pix recebido Cp ... INFLUX DOURADOS") com as saídas da Stone ("PEGORER IDIOMAS LTDA - Transferência").
- Quando o extrato foi reimportado, as linhas antigas da Stone foram apagadas e recriadas com novos identificadores — mas as entradas da Inter continuaram apontando para o par antigo, que não existe mais (pares com uma única linha).
- Como essas entradas "acham" que já têm par, o pareamento automático nunca as combina com as novas saídas da Stone. Consulta no banco confirma: 18 linhas marcadas como transferência sem par, cada uma com uma contraparte válida de mesmo valor, dia e conta diferente.

## O que será feito

### 1. Correção no pareamento automático (`src/hooks/useBankPilot.ts`)
- Antes de parear, limpar pares órfãos: grupos de `transfer_pair_id` com menos de duas linhas voltam a ficar sem par.
- Em seguida, o pareamento atual roda normalmente (mesmo valor, sentidos opostos, contas diferentes, até 2 dias).
- Nenhum valor, data, conta ou descrição é alterado; o histórico de conciliação é preservado.

### 2. Reparo dos dados de Dourados (execução pela própria tela, com sessão da equipe)
- Rodar o pareamento corrigido para a Dourados: limpa os pares órfãos e recria os 18 pares (17 Stone ↔ Inter e 1 Bradesco ↔ Inter).
- Conferir depois que "Transferências sem par" zera em Movimentações e que as linhas continuam Conciliadas, sem mudar saldo nem totais.

## Fora de escopo
- Nenhuma alteração em cálculos financeiros, Dashboard, Fluxo Diário, PDFs ou regras de Ignorar/Operação.
- Nenhuma linha é apagada; apenas o vínculo de par é refeito.

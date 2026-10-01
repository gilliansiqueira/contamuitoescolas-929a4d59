# Indaiatuba: limpar a conta Itaú e corrigir a leitura do PDF do Itaú

## O que encontrei
O extrato do Itaú tem **103 lançamentos** em setembro e fecha em **R$ 3.575,90 em 30/09**, igual no PDF e no OFX. Em 01/10 o saldo vai para R$ 3.575,94, com R$ 0,04 de rendimento.

No sistema, a conta Itaú tem **215 lançamentos**, que somam R$ 25.738,11. Dois valores aparecem na tela:
- **R$ 3.601,48** é só o saldo informado no extrato de 30/09, que estava R$ 25,58 errado.
- **Diferença de −R$ 22.136,63** é o que sobra quando o sistema compara esse saldo com a soma dos 215 lançamentos.

Os lançamentos a mais têm três origens:
1. **Lançamentos do Asaas gravados no Itaú.** No envio de 29/09 foram gravados 91 itens com texto de Asaas, como "Cobrança recebida – fatura…", "Taxa de boleto" e "Taxa de mensageria". Parece que o arquivo do Asaas foi enviado na conta Itaú.
2. **Linhas de saldo lidas como recebimento.** No envio do PDF (23 itens), linhas como "SALDO TOTAL DISPONÍVEL DIA 5.507,16" entraram como se fossem dinheiro entrando.
3. **Lançamentos repetidos.** Alguns lançamentos do PDF foram gravados de novo, porque ganharam um número diferente do OFX. Exemplo: o rendimento de R$ 0,03 de 21/09 aparece duas vezes.

## O que vou fazer
1. **Comparar cada lançamento do Itaú com o OFX enviado hoje**, considerando data, valor e sentido.
   - Ficam os 103 lançamentos que correspondem ao extrato, e a conciliação deles é mantida.
   - Os demais são removidos, com registro no histórico.
2. **Lançamentos do Asaas:** antes de apagar, confiro se já existem na conta Asaas.
   - Se já existirem, removo do Itaú.
   - Se não existirem, eles **não** são movidos automaticamente. Paro e te aviso.
3. **Corrigir o saldo informado** dos extratos do Itaú de 30/09 para **R$ 3.575,90**.
4. **Corrigir a leitura do PDF do Itaú** para nunca gravar linhas de saldo como lançamento:
   - SALDO TOTAL
   - SALDO TOTAL DISPONÍVEL DIA
   - SALDO BLOQUEADO
   - SALDO ANTERIOR
   - SALDO EM CONTA CORRENTE
   Vou incluir um teste com este PDF.
5. Recalcular o fluxo de Indaiatuba e conferir que a linha do Itaú mostra **R$ 3.575,90** e "confere em 30/09/2026".
6. Publicar no site oficial.

## Detalhes técnicos
- Conta Itaú: `88fea4d5-a771-4b2c-9e24-72d7b373c6cc`, com saldo inicial de R$ 635,19 em 31/08, que está correto.
- Importações com problema:
  - 29/09, com 91 linhas que somam −1.381,86. São as linhas do Asaas.
  - 29/09 com período a partir de 31/08, com 23 linhas que somam +18.846,70. Inclui as linhas "SALDO…".
  - 01/10, com 11 linhas que somam −25,56.
- A exclusão será feita com o registro `delete_bank_tx` ou um equivalente no `audit_log`, sem deixar registros órfãos. Depois disso, executar `sync_bank_cashflow_school`.
- No parser de PDF do Itaú (`parsers.ts`), adicionar um filtro de descrição `/^SALDO\b/i` antes de criar o lançamento.

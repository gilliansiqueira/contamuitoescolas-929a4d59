# Lauro de Freitas: saídas do PagSeguro que não existem no banco

## O que aconteceu
As duas saídas (R$ 692,67 em 01/10 e R$ 172,31 em 09/10) não vieram do extrato OFX. Elas entraram em 15/10, quando foi enviado o arquivo **"Extrato Financeiro - PagBank.pdf"**.

Esse PDF do PagBank mistura duas coisas: os valores **"A receber"** (vendas de cartão ainda não liberadas) e os valores **"Disponível"** (o saldo real da conta). A plataforma leu as linhas "A receber" como se fossem saídas da conta. Na verdade, "Pagamento Liberado A receber" é o dinheiro saindo do "a receber" e entrando no disponível. Na conta, ele aparece como **entrada**, e essas entradas já estão certas no sistema, vindas dos OFX de 02/10 e 09/10 ("Disponivel DEBITO VISA").

O mesmo PDF gerou **5 linhas falsas** ao todo:
- Pagamento Liberado A receber: R$ 692,67 (01/10) e R$ 172,31 (09/10)
- Taxa de intermediação A receber: R$ 4,53 (01/10), R$ 1,13 (09/10) e R$ 1,90 (14/10)

Total: **R$ 872,54 de saídas que não existem**.

O OFX que você mandou agora não tem nenhuma dessas linhas. Ele não deu erro porque está certo: a plataforma só reaproveitou as linhas que já estavam gravadas.

As outras 3 linhas do PDF, de 15/10 (Sponte R$ 446,56, Conta Muito R$ 2.940,00 e Pix LCR R$ 8.412,69), são reais. Elas aparecem também no OFX.

## O que vou fazer
1. **Corrigir Lauro de Freitas:** remover só as 5 linhas "A receber" do envio do PDF de 15/10, mantendo as 3 linhas reais. Depois, conferir se o saldo do PagSeguro em 30/10 fecha com o do OFX: R$ 1.299,02.
2. **Corrigir a leitura do PDF do PagBank:** linhas marcadas como "A receber" passam a ser ignoradas. Só entram as linhas "Disponível", que são as que mexem no saldo da conta. Isso vale para todas as empresas.
3. **Procurar o mesmo erro em outras empresas:** verificar se outro envio de PDF do PagBank gravou linhas "A receber" e listar para você antes de corrigir.
4. **Conferir que não duplica:** garantir que, ao subir o OFX completo de outubro, as 3 linhas reais de 15/10 não fiquem em dobro.

## Detalhes técnicos
- Linhas falsas: `bank_transactions` do import `f5014737…` cuja descrição termina em "A receber". A remoção passa pela função de exclusão existente, que mantém o histórico de auditoria.
- Leitor de PDF: filtrar a coluna/sufixo "A receber" no parser do extrato PagBank e criar um teste com essas linhas.
- Sem impacto nos cálculos: a classificação continua na SSOT.

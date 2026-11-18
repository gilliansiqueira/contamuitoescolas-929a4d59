# WNC: Tiny parou de receber lançamentos desde 15/11

## O que encontrei
- **Banco Inter está funcionando**: leituras de 3 em 3 horas, todas sem erro, até hoje (18/11). Entraram 32 lançamentos novos entre 14/11 e 18/11.
- **O envio ao Tiny parou**: o último envio foi em 14/11 às 16h21 (horário de Brasília). Na madrugada de 15/11 o Tiny recusou a autorização ("invalid_grant – Session doesn't have required client"). Desde então todas as tentativas param no mesmo ponto e nada mais é enviado.
- Isso acontece quando a autorização do aplicativo é encerrada no Tiny (troca de senha, sessão desconectada, aplicativo reautorizado em outro lugar). Não é erro de valores nem de categoria.
- Em 13/11 um lançamento de R$ 2.824,90 falhou porque o Tiny limitou o número de pedidos (erro 429). Ele ainda não foi enviado.

## O que fazer
1. **Você** (ou quem tem o login do Tiny da WNC) clica em "Autorizar na Olist" na tela de integração da WNC e confirma no Tiny. Só isso não dá para eu fazer, porque exige o login de vocês.
2. **Eu** rodo o envio na hora. Os lançamentos desde 14/11 que ainda não foram enviados entram de uma vez, com as mesmas regras de sempre (baixa no contas a pagar quando há uma conta só, senão lançamento no Caixa). Nenhum lançamento vai em dobro: cada lançamento do banco só pode ser enviado uma vez.
3. **Eu** reenvio o de R$ 2.824,90 que falhou em 13/11.
4. Mando uma planilha com o que foi enviado e o que ficou como "A classificar".
5. **Aviso para não acontecer em silêncio de novo**: quando o Tiny recusar a autorização, aparece um aviso vermelho na Central (na linha da WNC) e na tela de integração, dizendo "Tiny desconectado – autorizar de novo". Hoje o erro só fica gravado e ninguém vê.

## Detalhes técnicos
- `erp_connections` WNC: `authorized=false`, `last_ok_at` 2026-11-15 06:21 UTC, `last_error` invalid_grant.
- Reenvio: `olist-sync` ação de envio; o erro 429 é reprocessado apagando a linha `status='erro'` do `erp_push_log` antes (único por `bank_transaction_id`, então não duplica).
- Aviso: leitura de `erp_connections.authorized/last_error` na carteira da Central e no painel da integração; sem alterar cálculos.

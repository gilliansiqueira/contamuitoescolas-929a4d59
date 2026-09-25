# Banco do Brasil de Dourados: diferença explicada pelo lançamento futuro

## Resposta: o OFX traz o lançamento futuro?
Não. O OFX do BB só traz o que já foi efetivado. Os "Lançamentos futuros" (como o PGT CARTAO de 2.159,03) aparecem apenas no PDF e na tela do banco. O arquivo de 25/09 confirma isso: a última linha é a VIVO de 190,53 e não há nenhum PGT CARTAO.

## O que a conferência mostrou
```text
Total calculado pelas linhas até 25/09 (em conta + aplicado)   151.130,00
(-) PGT CARTAO 25/09 (lançamento futuro, não veio no OFX)       -2.159,03
(+) Rendimento do BB Rende Fácil (ainda não lançado)               +21,21
= Total real no fim de 25/09                                   148.992,18
```
Com o PGT CARTAO, fica faltando só o rendimento de 21,21. Todas as outras contas batem centavo por centavo.

## O que vou fazer
1. **Lançamentos futuros vindos do PDF do BB:** ao subir o PDF do extrato (junto com o OFX ou sozinho), o sistema lê o bloco "Lançamentos futuros" e cria cada linha como **Previsto**, com o selo "Aguardando extrato".
   - Ele entra na conciliação e no saldo do dia para vocês conferirem.
   - Quando o próximo OFX trouxer o lançamento real (mesma conta, mesmo valor, mesmo sentido, data até 3 dias depois), o real **substitui** o previsto automaticamente. Nunca ficam os dois, então não há duplicidade.
   - Se o real não chegar em 5 dias úteis, o previsto fica destacado para a equipe revisar ou excluir.
2. **Pequenas diferenças (rendimento/centavos):** continuam em "A confirmar no próximo extrato", sem travar o Dashboard nem o Fluxo Diário.
3. Conferir o cheque de 580,80 de 22/09 (depósito, devolução e novo depósito) para garantir que só o depósito válido conta como receita.

## Regras preservadas
- Nenhum lançamento real é alterado ou apagado. Só o "Previsto" é substituído.
- Cada previsto guarda o arquivo de origem e a data da importação.
- Nada antes de 01/09/2026 é tocado.

## Detalhes técnicos
- Em `parsers.ts`, `parsePdfLines` passa a reconhecer a seção "Lançamentos futuros" e devolve essas linhas com a marcação `futuro: true`.
- Migration: coluna `is_forecast boolean default false` e `replaced_by uuid` em bank_transactions, com GRANTs e RLS inalterados. O previsto entra com recon_status Pendente.
- Ao importar um OFX, a mesma rotina procura previstos da conta que casem por valor, sentido e data até +3 dias. Encontrando, apaga o previsto (fica registrado no histórico de conciliação) e mantém o real. Tudo idempotente pelo dedup_hash.
- O guard de imutabilidade permite essa remoção apenas para linhas com `is_forecast = true`.
- Testes: previsto e real no mesmo período nunca somam juntos; o saldo do BB em 25/09 fecha com diferença de 21,21.

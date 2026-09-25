# Aviso de pagamento repetido mais claro (Fluxo Bancário)

## O que muda para você
Na conferência do Fluxo Bancário, a seção "Para revisar" só vai avisar quando, no mesmo dia e na mesma conta, houver **duas ou mais movimentações do mesmo valor para/da mesma pessoa ou empresa**.

- Movimentações sem uma pessoa identificada (tarifas, IOF, rendimentos, aplicações automáticas, "PIX recebido" sem nome) **não geram mais aviso**.
- O texto deixa de dizer "Possível duplicidade" e passa a dizer, por exemplo:
  "2 pagamentos iguais de R$ 1.200,00 para JOÃO DA SILVA em 12/09/2026 (Sicoob) — verificar se é pagamento repetido".
  Para entradas: "2 recebimentos iguais de ... de JOÃO DA SILVA ...".
- É só um aviso: nenhum valor, data, saldo ou classificação é alterado, e nada fica bloqueado.

## Como a pessoa é identificada
A partir da descrição do extrato, o sistema tira as palavras genéricas do banco (PIX EMIT., PIX REC., TED, DOC, TRANSF., PAGTO, DÉB., CRÉD., números de documento/autenticação) e fica com o nome ou CPF/CNPJ da outra parte. Se não sobrar um nome/documento, a linha não entra no aviso.

## Detalhes técnicos
- `src/components/fluxo-bancario/CashflowConference.tsx`: substituir a chave atual (`conta|data|tipo|valor|descricao`) por `conta|data|tipo|valor|contraparte`, ignorando linhas com contraparte vazia, transferências internas e aplicações automáticas (`isAutoInvest`, `transfer_pair_id`).
- Nova função pura `extractCounterparty(descricao)` em `src/lib/bankStatements/counterparty.ts` (normaliza acentos/maiúsculas, remove prefixos bancários e tokens numéricos; preserva CPF/CNPJ quando existir).
- Teste unitário com descrições reais de Sicoob, BB, Inter e Sicredi (com nome, sem nome, tarifa).
- Validar em Dourados: comparar a lista nova com as 13 ocorrências atuais e mostrar quais continuam e quais saíram.

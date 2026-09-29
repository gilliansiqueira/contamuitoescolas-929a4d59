# Farmácia Magistral — liberação do botão "Aprovar e ativar"

## Resposta direta

Sim. A diferença de R$ 6.924,89 não era de lançamento faltando — os 2.570 lançamentos do extrato estavam todos no sistema. O problema era o saldo que o arquivo do Inter informava: ele trazia o saldo do dia 29/09 (R$ 43.229,54, dia em que o arquivo foi baixado), e não de 28/09, último dia do extrato.

Os saldos do Inter já foram corrigidos pelos valores do PDF do banco:

- 25/09: R$ 56.225,87
- 28/09: R$ 36.304,65

Com o saldo certo de 28/09, a diferença zera e o botão "Aprovar e ativar" fica liberado — sem precisar usar a tolerância de R$ 15,00 (que continua valendo só para diferenças pequenas de rendimento/centavos).

## O que falta fazer

1. Confirmar na tela da Farmácia Magistral que a linha do Inter mostra R$ 36.304,65 e "confere em 28/09/2026", com o botão de aprovação habilitado.
2. Publicar no site oficial as mudanças que estão só na prévia:
   - saldo de arquivo com data posterior ao fim do extrato passa a ser só informativo (não entra na conferência) — evita que o problema do Inter se repita;
   - cards de Relatórios por etapa e filtros Receitas/Despesas na conciliação;
   - tolerância de R$ 15,00, bolinha de situação, justificativas e demais ajustes anteriores.

## Detalhes técnicos

- Saldos corrigidos em `bank_statement_imports` (25/09 e 28/09), com registro em `audit_log` (`bank_saldo_extrato_corrigido`).
- Em `parsers.ts`, quando `LEDGERBAL.DTASOF` é posterior ao fim do extrato, o saldo não preenche `saldoFinalInformado` — apenas `saldoAtualCabecalho` com aviso.
- Nenhum lançamento foi alterado; apenas os saldos de conferência.

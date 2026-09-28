# Publicar e subir a tolerância de rendimento para R$ 15,00

## O que muda
1. Conferir a diferença do Portão na prévia de ativação do Fluxo Bancário: confirmar que fica abaixo de R$ 15,00 e que vem de rendimento/centavos, sem lançamento faltando nem duplicado.
2. Mudar o limite de R$ 10,00 para R$ 15,00 em todas as empresas:
   - botão "Aprovar e ativar" deixa de travar quando a diferença é de até R$ 15,00 (aviso amarelo continua aparecendo);
   - Dashboard e Fluxo Diário mostram "A confirmar no próximo extrato" até R$ 15,00; acima disso, "Diferença a conferir".
3. Publicar no site oficial as mudanças que estão só na prévia: saldo conferido separado do fechamento previsto (Cuiabá), estados da Central, bolinha colorida, tolerância e correções de "A classificar".

Se o Portão passar de R$ 15,00, eu mostro conta por conta de onde vem a diferença antes de mexer no limite.

## Detalhes técnicos
- Criar uma constante única `BANK_SMALL_DIFF_TOLERANCE = 15` em `src/lib/bankStatements/confirmedBalance.ts` e usá-la em `ActivationPreview.tsx` (hoje 10 local), `Dashboard.tsx` (linha 1056) e `DailyFlowTable.tsx` (linhas 309 e 396), para não repetir número solto.
- Atualizar o texto da regra no AGENTS.md; rodar os testes; checar build; depois publicar.

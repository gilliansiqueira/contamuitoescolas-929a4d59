# Botão "Recalcular planilha" visível na Renovação escolar

## Problema
O botão de recalcular a planilha (etapa 2, quadro "Enviar relatório do Sponte") é só um ícone de seta girando, sem texto. A equipe não encontrou o recurso.

## Mudança
Em `src/components/renovacao/RenovacaoModule.tsx`:

1. Substituir o botão só-ícone ao lado de "Parcelas a partir de (vencimento)" por um botão com texto: **"Recalcular planilha"** (mantendo o ícone de seta).
2. Manter o comportamento atual: recalcula as parcelas a partir da data escolhida e remonta a planilha preservando edições manuais da equipe.
3. Manter o texto de ajuda abaixo ("Evita contratos antigos. Recalcular preserva tudo o que a equipe já editou.").

## Fora de escopo
- Nenhuma mudança em dados, cálculos ou regras de cruzamento.
- Nenhuma mudança nas outras etapas.

# Agilizar "Categorias não reconhecidas" na importação do Realizado

## O que muda na tela
1. **Botão "Aceitar todas as sugestões (N)"** no topo do quadro laranja: aplica de uma vez todas as sugestões que aparecem (ex.: 9.44 Salário Consultor → Salário Consultores). Depois dá para trocar qualquer uma individualmente.
2. **Check ao lado de cada linha**: a sugestão fica visível já na própria linha, com um botão ✓ grande "É essa" ao lado da lista, em vez do botão pequeno embaixo. Mostra a confiança em texto simples ("muito parecida", "parecida") em vez de "fuzzy 86%".
3. **Busca dentro da lista "Escolher..."**: digitar parte do nome para filtrar as categorias, sem rolar a lista inteira.
4. **Separar resolvidas de pendentes**: contador "faltam X de 35" e opção "mostrar só pendentes", para as já associadas saírem do caminho. Quadro maior (hoje corta em 3 linhas).
5. **Pedir sugestão à IA para todas de uma vez**: botão "Sugerir as que faltam com IA" que roda a IA nas linhas sem sugestão; o resultado continua só sugestão — você confirma com o check ou com "Aceitar todas".

Nada é gravado sem você clicar em Importar; a regra de memória (lembrar a associação para as próximas importações) continua igual.

## Detalhes técnicos
- Arquivo: `src/components/realizado/ImportacaoRealizado.tsx` (bloco de unmapped, ~linhas 515–640).
- "Aceitar todas": percorre `unmapped`, aplica `suggestions[norm].target` onde não há `categoryMappings[norm]` nem `newCatMappings[norm]`.
- Seleção com busca: trocar `Select` por `Popover + Command` (shadcn já existente), mantendo grupos Modelo Financeiro / Plano de Contas e "+ Criar nova categoria".
- IA em lote: chamar `categorize-expense` sequencialmente (limite de concorrência 3) para as linhas sem sugestão.
- Sem mudanças no banco nem nos cálculos.

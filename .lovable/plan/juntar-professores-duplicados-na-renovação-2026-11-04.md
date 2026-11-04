# Juntar professores duplicados na renovação

## O que está acontecendo
Em Manaus Centro o mesmo professor aparece com nome curto (Sponte) e nome completo (Omni):

| Nome curto | Nome completo |
|---|---|
| Beatriz Elessondres (1) | Beatriz Elessondres Rodrigues (33) |
| Isaac Ginoris (1) | Isaac Ginoris Oramas (4) |
| Raissa Souza (1) | Raissa Tavares de Souza (32) |
| Violeta Bastos (2) | Violeta Bastos de Mattos Areosa (39) |

Por isso o resumo por professor mostra linhas separadas.

## O que vou fazer
1. Regra para todas as escolas: quando um nome de professor tem todas as palavras contidas, na mesma ordem, no nome mais completo de outro professor da mesma planilha (e o primeiro nome é igual), passa a usar o nome completo. Só junta quando houver um único nome completo compatível — se houver dúvida, não junta.
2. Aplicar na tela, no resumo por professor e na planilha baixada.
3. Corrigir as 5 linhas atuais de Manaus Centro, com registro no histórico de alterações; o que foi preenchido à mão continua valendo.
4. Gerar de novo a planilha de Manaus Centro e conferir que sobram só 10 professores.

## Detalhes técnicos
- Função pura `canonicalProfessors(names)` em `src/lib/renewal/professorNames.ts` (normaliza acentos/maiúsculas, subsequência de palavras, primeiro nome igual, candidato único), com teste em `src/test/professorNames.test.ts`.
- Usada na montagem das linhas em `mergeEngine.ts` (após juntar Sponte + Omni) e no `exportXlsx.ts` (resumo).
- Ajuste dos dados existentes em `renewal_rows.imported->>'professor'` do sheet de Manaus Centro.

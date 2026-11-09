# Renovação Floripa (Santa Mônica e Ingleses): última parcela sem material

## Resposta à dúvida
Não. Em parte dos alunos, a data da última parcela que está na planilha é a do **material didático**, não a do curso.

Comparei as duas planilhas finalizadas com o Contas a Receber que foi importado:

| Escola | Alunos com data | Batem com o curso | Diferentes | Desses, a data é do material |
|---|---|---|---|---|
| Santa Mônica | 213 | 160 | 53 | 45 |
| Ingleses | 217 | 167 | 50 | 39 |

Exemplos:
- Carolina Mello Borges (Santa Mônica): na planilha está 10/03/2027 (material). A última parcela do curso é 20/12/2026.
- Arthur Bertechini Saturnino (Ingleses): na planilha está 30/12/2026 (material). A última do curso é 20/10/2026. Por isso a forma de pagamento aparece como "Recebimento Direto Franqueadora".

Os outros casos diferentes, cerca de 8 a 11 por escola, vêm de taxa de matrícula, reposição de aula ou eventos, que também entraram por engano. Há ainda alunos que só têm material em aberto.

## Causa
No Sponte dessas escolas, as categorias começam com número ("5. MATERIAL DIDÁTICO", "6. TAXA DE MATRÍCULA", "8. REPOSIÇÃO DE AULAS"). A regra da plataforma só reconhecia material, taxa e reposição quando o nome **começava** com essas palavras. Com o número na frente, tudo passou a contar como parcela do curso.

## O que vou fazer
1. Corrigir a regra para ignorar a numeração no começo da categoria. Com isso, material (a não ser que a escola marque para incluir), taxa, reposição, venda, juros/multa, eventos/bilheteria, make-up test, TOEIC/TOEFL e "outras receitas" ficam fora da última parcela do curso.
2. Recalcular "Venc. última parcela", "Término do pagamento" e "Forma de pgto atual" das duas escolas a partir das importações já feitas. Não precisa subir os arquivos de novo. As correções feitas à mão pela equipe são mantidas.
3. Te entregar uma planilha com cada aluno que mudou (data antiga e data nova) para conferir antes de mandar ao cliente.
4. Conferir se outras escolas com categorias numeradas foram afetadas e listar quais.

## Detalhes técnicos
- `src/lib/renewal/mergeEngine.ts`: normalizar a categoria removendo o prefixo `^\d+(\.\d+)*\.?\s*` antes de `isMaterial`/`NOT_MODULE`; ampliar `NOT_MODULE` para `bilheteria|evento|make-up|toeic|toefl|outras receitas`.
- Testes em `src/test/renewal.test.ts` com as categorias numeradas reais (material, taxa, reposição fora; "2. PARCELA DO CURSO TURMAS", "3. PACELA DO CURSO PERSONAL" e "4. PARCELA DO CURSO VIP" dentro).
- Recalcular `renewal_rows.imported` das duas escolas com o mesmo motor, preservando `overrides`.

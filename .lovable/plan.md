# Uberlândia Centro: as 250 "linhas que não vieram no novo arquivo"

## O que aconteceu
- Em 16/10, os arquivos de turmas enviados na **Uberlândia Centro** ("Turmas Centro.xlsx" e "Turmas Upgrade.xls") eram, na verdade, da **Santa Mônica**: os 251 alunos são exatamente os mesmos do arquivo de turmas da Santa Mônica, com as mesmas matrículas.
- Hoje (29/10) foi enviado o arquivo certo da Centro ("Uberl. Centro - Turmas.xls", 239 alunos). Ele não tem nenhum aluno em comum com os arquivos anteriores.
- Como o sistema nunca apaga linhas sozinho, os 250 alunos da Santa Mônica continuaram na planilha da Centro e foram para a Conferência como "não veio na nova importação". Por isso a planilha da Centro está com 490 linhas, quando o certo seriam cerca de 239.
- A planilha da Santa Mônica não foi afetada.

## Correção
1. Tirar da planilha da Centro os 250 alunos da Santa Mônica e os avisos ligados a eles na Conferência. A planilha fica só com os 239 alunos da Centro, que continuam com tudo o que já foi preenchido.
2. A Hannah corrigiu à mão 3 desses alunos na Centro em 21/10 (Davi Silva e mais dois, mat. 6058, 6068 e 6047). Vou passar essas correções para os mesmos alunos na planilha da Santa Mônica, sem apagar o que já estiver preenchido lá.
3. **Proteção para as próximas vezes:** quando um arquivo de turmas novo não tiver quase nenhum aluno em comum com a planilha atual, ou tiver os mesmos alunos de outra escola, o sistema avisa antes de gravar: "Este arquivo parece ser de outra escola". O envio só segue se a equipe confirmar.

## Detalhes técnicos
- As linhas que saem são as de `renewal_rows` da folha da Centro com aviso `fora_da_base` aberto. Os avisos correspondentes em `renewal_issues` também saem.
- Os 3 overrides vão para as linhas da Santa Mônica com a mesma matrícula, só nas colunas que ainda estiverem sem override.
- Para a proteção: comparar as matrículas do arquivo com as da folha atual. Se a sobreposição for menor que 20% numa folha que já tem dados, ou se o arquivo bater com mais de 80% da folha de outra escola da carteira, mostrar uma confirmação no envio. Incluir teste da regra.

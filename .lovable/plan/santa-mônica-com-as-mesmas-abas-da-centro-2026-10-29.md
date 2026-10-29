# Santa Mônica com as mesmas abas da Centro

## Causa encontrada
- As duas escolas usam modelos de planilha quase iguais (mesmas colunas, cores e quadros).
- A diferença está na configuração de abas separadas: a Centro tem "Personal, VIP, Semi, ON"; a Santa Mônica está vazia. Por isso os 252 alunos da Santa Mônica caem todos na aba principal (16 Personal, 5 Online e 3 VIP misturados com os presenciais).

## O que vou fazer
1. Copiar para a Santa Mônica a mesma configuração de abas da Centro (Personal, VIP, Semi, ON).
2. Reorganizar os alunos já salvos da Santa Mônica nas abas certas, usando a mesma regra que o sistema usa na importação (modalidade e, se for outra, início do nome da turma). Nada do que a equipe preencheu é alterado — muda só a aba de cada aluno.
3. Conferir o resultado: contagem por aba (esperado: Personal 16, ON 5, VIP 3, restante na principal) e baixar o Excel da Santa Mônica para comparar com o da Centro.

## Detalhes técnicos
- `renewal_settings.separate_modalities` da escola Santa Mônica ← valor da Centro.
- Atualizar `renewal_rows.imported->>'aba'` da planilha da Santa Mônica com `abaFor(modalidade, turma, separate)`, preservando `overrides`/`manual`.
- Sem mudança de código; próximas importações já separam sozinhas.

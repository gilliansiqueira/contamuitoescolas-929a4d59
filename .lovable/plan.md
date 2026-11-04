# Relatório de turmas de Londrina (Omni)

## O que encontrei no arquivo
- O relatório está correto internamente: 79 turmas, todas "Aberta", sem turma repetida; soma de alunos 279 e capacidade 595 batem com o Resumo (ocupação 46,9%, 316 vagas ociosas).
- Mas é o relatório "Turmas ativas – ocupação": uma linha por turma (turma, curso, instrutor, sala, horário, quantidade de alunos). Não tem o nome nem a matrícula de cada aluno.
- A planilha de renovação é montada aluno por aluno, por isso a plataforma não conseguiu ler. Não é erro do arquivo nem de geração.

## O que fazer
1. No Omni, exportar o relatório "Alunos por turma" (colunas Turma, Aluno, Matrícula, Instrutor) — esse a plataforma já lê, e monta a renovação de Londrina normalmente.
2. Melhoria na plataforma: quando alguém enviar este relatório de ocupação, em vez da mensagem genérica "Não reconheci o relatório", mostrar: "Este é o relatório de ocupação das turmas (sem alunos). Exporte 'Alunos por turma' no Omni." 
3. Opcional: aceitar este arquivo junto com o "Alunos por turma" só para completar sala, horário e capacidade de cada turma (nunca adiciona alunos).

## Detalhes técnicos
- `src/lib/renewal/sponteParser.ts`: detectar cabeçalho `turma + capacidade + ocupacao` sem `aluno` e lançar erro específico; reaproveitar `omniTurmasInfo` (já lê Turma/Instrutor/Sala/Alunos) para o complemento do item 3.
- Teste em `src/test/` com o cabeçalho deste arquivo.

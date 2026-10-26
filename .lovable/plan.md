# Renovação: aceitar a planilha de turmas do Omni

## O que muda
Na hora de enviar o relatório de turmas, o sistema passa a reconhecer sozinho se o arquivo veio do **Sponte** ou do **Omni** ("Alunos por turma"). Não precisa escolher nada: os dois funcionam, e a planilha de renovação sai igual.

## Como cada coluna do Omni entra
| Omni | Vira na planilha |
|---|---|
| Turma | Turma |
| Curso / Livro | Curso / Estágio |
| Instrutor | Professor |
| Modalidade / Tipo | Modalidade (Personal/VIP continuam indo para aba separada, também pelo nome da turma) |
| Início / Fim | Data início / Data término |
| Aluno, Telefone, E-mail | Aluno, Fone celular, E-mail |
| Matrícula "6409/2" | Matrícula **6409** e Nº contrato **2** |
| Status aluno | Situação do aluno |
| Status turma | usado para separar turmas "em formação" (próximo período) |
| Integrantes atuais | calculado: quantos alunos a turma tem no arquivo |

Dias, Horário, Idioma, Formato e Semestre não existem no Sponte. Eles entram como colunas extras que podem ser ligadas no Modelo da escola, se quiserem.

## Cruzamento com o financeiro
O cruzamento com o Contas a Receber usa o número antes da barra, então "6409/2" encontra a matrícula 6409. Ainda não tenho o Contas a Receber do Omni. Até ele chegar, a escola que migrou continua mandando o financeiro do Sponte, e a coluna "Venc. última parcela" fica em branco quando não houver financeiro. Se me mandarem esse arquivo, faço o mesmo ajuste para ele.

## Detalhes técnicos
- `sponteParser.ts`: `detectSource` reconhece o cabeçalho do Omni (`turma`, `aluno`, `matricula`, `instrutor`) e chama `fromOmni(rows)`, que converte para as chaves do Sponte (`Nome`, `Professor`, `NumeroMatricula`, `NumeroContrato`, `DataInicio`, `DataTermino`, `FoneCelular`, `Email`, `SituacaoAluno`, `SituacaoTurma`, `IntegrantesAtuais`). O resto do processo (cruzamento, planilha, exportação) não muda.
- `fields.ts`: campos opcionais `dias`, `horario`, `semestre`, que começam ocultos.
- Teste em `src/test/renewal.test.ts` com as linhas do arquivo enviado: o arquivo é reconhecido como turmas, a matrícula sai sem a barra, o professor vem do Instrutor e a contagem de integrantes por turma está certa.

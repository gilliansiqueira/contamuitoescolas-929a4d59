# Renovação Cuiabá Jardim Itália: responsável financeiro dos menores

## O que temos hoje
As duas planilhas que já estão na plataforma não trazem o responsável financeiro:
- **Turmas existentes:** tem idade, CPF, telefones e e-mail do aluno, mas nenhum campo de responsável. Dos 334 alunos, 241 são menores de 18 anos.
- **Contas a receber:** o campo "Sacado" é sempre o nome do próprio aluno, inclusive nos 241 menores.

Por isso, preciso do **cadastro de alunos do Sponte** com o nome do responsável financeiro.

## O que você me envia
O relatório de cadastro de alunos do Sponte de Jardim Itália, com estas colunas:
- nome do aluno;
- matrícula, ou o CPF do aluno;
- nome do responsável financeiro (o CPF e o telefone do responsável também ajudam, se vierem).

## O que eu faço quando o arquivo chegar
1. Confiro o arquivo: quantos alunos vieram, quantos menores ficaram sem responsável e quais nomes não foram encontrados.
2. Cruzo cada aluno pela matrícula. Quando não houver matrícula, uso o CPF e, por último, o nome.
3. Incluo a coluna **"Responsável financeiro"** na planilha de renovação. Ela é preenchida só para alunos menores de 18 anos; nos maiores fica em branco.
4. Nada que você já ajustou à mão se perde, e as colunas Modalidade e Matrícula continuam fora, como o franqueado pediu.
5. Gero a planilha atualizada para você baixar e mostro a lista dos menores que ficaram sem responsável, se houver algum.

## Detalhes técnicos
- Nova fonte opcional `cadastro_alunos` na Renovação (`sponteParser.ts` / `multiSource.ts`), que só preenche o campo `responsavel_financeiro` quando ele está vazio. Mantém `overrides`, como as demais fontes.
- Regra de menor de idade pela coluna `Idade` das Turmas existentes. Teste puro para o cruzamento e para a regra da idade.

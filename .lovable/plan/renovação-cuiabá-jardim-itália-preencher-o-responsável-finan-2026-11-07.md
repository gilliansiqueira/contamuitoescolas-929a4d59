# Renovação Cuiabá Jardim Itália: preencher o responsável financeiro

## Conferência do arquivo
- O cadastro tem 337 alunos e traz a coluna "ResponsavelFinanceiro".
- Os 334 alunos da planilha de renovação foram encontrados pela matrícula, e todos têm responsável preenchido no cadastro.
- Os 3 alunos que estão só no cadastro ficam de fora, como você pediu.

## O que faço
1. Incluo a coluna **"Responsável financeiro"** na planilha de renovação de Jardim Itália, logo depois dos telefones.
2. Preencho a coluna só para os menores de 18 anos, conforme a idade da planilha de turmas (241 alunos). Nos maiores, ela fica em branco, como o franqueado pediu.
3. Nada que você já ajustou muda: as colunas Modalidade e Matrícula continuam fora, e as correções manuais ficam como estão. Se você tiver digitado um responsável à mão, o seu continua valendo.
4. A planilha também passa a aceitar esse cadastro como envio opcional nas próximas atualizações, para outras empresas poderem usar o mesmo recurso.
5. Gero a planilha atualizada para você baixar e confiro a quantidade preenchida.

## Detalhes técnicos
- Nova fonte opcional `cadastro_alunos` em `sponteParser.ts`/`multiSource.ts`. O cabeçalho é localizado pela linha que contém "NumeroMatricula", e o cruzamento é feito por matrícula; quando não houver, usa o CPF e, por último, o nome normalizado. Ela só preenche `responsavel_financeiro` quando o campo está vazio e preserva `overrides`.
- Gravo os dados do arquivo para Jardim Itália nas linhas existentes (`renewal_rows.imported`), com registro em `renewal_imports`. Nova coluna com id estável no modelo da planilha da empresa.
- Testes puros para o cruzamento e para a regra de idade abaixo de 18.

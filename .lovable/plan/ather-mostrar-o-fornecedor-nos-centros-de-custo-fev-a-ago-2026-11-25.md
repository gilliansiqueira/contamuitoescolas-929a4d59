# Ather: mostrar o fornecedor nos centros de custo (fev a ago)

## O que encontrei
- De fevereiro a agosto, 836 despesas dos centros de custo foram gravadas só com o nome "Despesas", sem fornecedor e sem categoria. Por isso a tela mostra "Geral". De setembro em diante, o fornecedor já aparece (ex.: "ZZAT MAT DE CONSTRUCAO LTDA · Materiais").
- As contas pagas de fevereiro a agosto, que já estão na plataforma, têm o fornecedor e a categoria. Exemplo: em 03/02, os R$ 654,99 da Reforma Reitoria IEL são da FABRISUL (Materiais).

## O que vou fazer (só na Ather, só no texto da descrição)
1. Para cada despesa "Despesas" do centro de custo, procurar nas contas pagas um lançamento com a mesma data e o mesmo valor.
   - **Achou exatamente 1 (454 despesas):** a descrição passa a ser "Fornecedor · Categoria", no mesmo formato de setembro em diante.
   - **Achou mais de 1 (14 despesas):** preencher só quando todos forem do mesmo fornecedor. Se forem de fornecedores diferentes, a despesa fica como está.
   - **Não achou nenhum (368 despesas):** fica como está. Provavelmente são pagamentos divididos entre vários centros, com valores que não batem um a um.
2. Os valores, as datas, os centros e os totais não mudam. Muda só o texto que aparece na linha.
3. Antes e depois, conferir que o total de cada centro continua igual.

## Para completar as 368 restantes
Vou precisar do relatório de contas pagas por centro de custo de fevereiro a agosto, com fornecedor, como o que a equipe usava na Quintal. Com ele, preencho o restante do mesmo jeito.

## Detalhes técnicos
- Atualização de dados (`expense_detail_items.descricao`) com school_id da Ather, tipo despesa e descricao='Despesas'. O casamento com `realized_entries` é por data e valor arredondado a 2 casas; o texto vem de `descricao` e `conta_nome` no formato "X · Y".
- Sem mudança de código nem de cálculos. A tela já divide "Fornecedor · Categoria" em atividade e tipo.
- As 39 receitas genéricas ("Receitas") ficam fora, porque não existe fonte com o cliente.

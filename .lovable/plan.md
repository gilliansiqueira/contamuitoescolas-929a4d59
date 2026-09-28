# Corrigir erro ao importar extrato na Ather e na Obras Nascimento

## Causa encontrada
Na importação do extrato, o sistema procura no modelo financeiro da empresa um tipo chamado exatamente "Receita" (entradas) e "Despesa" (saídas).
- **Ather Engenharia**: o modelo "Personalizado" tem "Receita", mas o tipo de saída se chama **"Despesas"** (plural). Por isso a busca falha. Esse modelo é usado só pela Ather.
- **Obras Nascimento**: a empresa está **sem nenhum modelo financeiro escolhido**.

## O que será feito
1. Fazer a importação aceitar também "Receitas"/"Despesas" (plural) como tipo padrão. O nome do tipo "Despesas" da Ather fica como está e os lançamentos existentes não mudam.
2. Colocar na Obras Nascimento o mesmo modelo "Personalizado" da Ather, como você escolheu.
3. Testar a importação nas duas empresas e conferir que os extratos entram com entradas como Receita e saídas como Despesas.

## Impacto
- Nenhum dado apagado nem alterado. O histórico, o Dashboard e o Fluxo Diário continuam iguais.
- As outras empresas continuam funcionando igual: todas já têm "Receita"/"Despesa" no singular.

## Detalhes técnicos
- Nova migração com `CREATE OR REPLACE` de `apply_bank_default_model_item()`: a comparação passa a ser `lower(btrim(i.name)) IN ('receita','receitas')` / `IN ('despesa','despesas')`. Também muda a checagem de itens padrão no ramo `operacao`. Conferir `validate_bank_model_item()` e aplicar a mesma regra se ela comparar os nomes.
- Alteração de dados: `schools.financial_model_template_id = '037f4b07-ff20-4a64-8c00-6b0341f3769b'` para Obras Nascimento (1d4f4f14-eee0-41f2-83f7-64d1c5c52f89), com registro no audit_log.

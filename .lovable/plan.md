# Ather: Dashboard mostrando resultado errado (histórico de fev a ago)

## O que encontrei
- O histórico de fevereiro a agosto está salvo na plataforma igual à sua planilha, valor por valor. Nada foi apagado.
- O problema está nos nomes. O histórico foi gravado como "despesa", "entrada aporte" e "saida aporte", mas o modelo financeiro da Ather usa "Despesas", "Aporte (Entrada)" e "Aporte (Saída)".
- O Dashboard só considera os nomes que existem no modelo. Por isso as despesas de fevereiro a agosto (R$ 4,27 milhões) ficam de fora e só as receitas entram. É daí que vem o resultado positivo de mais de 2 milhões.

## O que vou fazer (só na Ather, só no histórico)
Renomear as 33 linhas do histórico de fev a ago para os nomes do modelo, sem mudar nenhum valor:
- despesa → Despesas
- receita → Receita
- entrada aporte → Aporte (Entrada)
- saida aporte → Aporte (Saída)
- aplicacao → Aplicação
- resgate → Resgate
- entrada emprestimo → Entrada Empréstimo (inclui o empréstimo de agosto e o crédito liberado de março)

Nenhuma regra de cálculo muda e nenhuma outra empresa é afetada.

## Resultado esperado no Dashboard (todos os meses)
- Fev a ago (planilha): −R$ 573.094,37
- Setembro (banco): −R$ 208.619,85
- Outubro (banco): −R$ 158.484,90
- Novembro (banco, até hoje): +R$ 70.248,90
- Total: cerca de −R$ 869.950,22

Na sua planilha, setembro a dezembro estão zerados. Na plataforma, esses meses vêm do extrato do banco.

## Para você decidir depois (não incluído)
Em set/out, algumas entradas aparecem como Receita, mas podem não ser faturamento:
- resgates de aplicação: R$ 60.359,26 (Inter) e R$ 40.252,09 (BB);
- 3 Pix da Rahissa em outubro, R$ 112.000,00 no total.

## Detalhes técnicos
- Atualização de dados em `historical_monthly` para school_id a7786ff0-…, trocando `tipo_valor` pelo nome exato do item do modelo. Sem migration e sem mudança de código.
- Causa: `useSchoolModel.isInModel` compara `normalizeTipo` (minúsculas e sem acento, mas mantém plural e parênteses). Por isso "despesa" ≠ "despesas".
- Verificação: refazer a soma por mês com os novos nomes e conferir com a planilha.

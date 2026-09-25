# Centro de Custos para Ather Engenharia e Obras Nascimento

## Situação atual
- Este sistema já tem uma versão básica do recurso, chamada "Detalhamento". O projeto Quintal de Casa foi copiado deste mesmo sistema e evoluiu essa parte para "Centro de Custos".
- **Ather Engenharia**: recurso ligado, com o nome "Detalhamento", 5 grupos e 42 itens já cadastrados aqui.
- **Obras Nascimento**: recurso desligado, sem nenhum grupo.
- O Quintal de Casa usa outro banco de dados. Consigo ler o código dele, mas não os dados. Os dados da Ather que estão lá precisam vir por planilha exportada.

## O que o Quintal de Casa tem a mais
1. Cada lançamento indica se é **receita ou despesa**. Aqui, tudo é tratado como despesa.
2. **Resultado por centro de custo**: gráfico e fechamento de cada centro (receitas - despesas).
3. **Planilha completa**: colar as colunas centro de custo, data, descrição, tipo e valor. Centros novos são criados sozinhos.
4. Nome padrão "Centro de Custos".
5. Leitura de todos os lançamentos, sem o limite de 1.000 linhas.

## O que será feito
1. Trazer essas melhorias para cá sem mudar nada nas outras empresas. As empresas que já usam "Detalhamento" continuam iguais; os itens atuais passam a valer como "despesa".
2. Ligar o recurso só para a Ather e a Obras Nascimento, com o nome "Centro de Custos". O padrão das empresas novas não muda.
3. O Centro de Custos é só uma visão de análise. Não mexe em Receita, Despesa, Resultado, Caixa, Dashboard nem Fluxo Diário, que continuam vindo dos cálculos oficiais.
4. **Importar o histórico da Ather**:
   - No Quintal de Casa, você exporta a planilha dos centros de custo da Ather (centro, data, descrição, tipo, valor).
   - Aqui, a planilha passa por uma conferência antes de gravar: quantidade de linhas, total de receitas e despesas, totais por centro e por mês.
   - O sistema aponta linhas que já existem entre os 42 itens atuais da Ather, para não duplicar. Você escolhe se vai manter, substituir por período ou somar.
   - Cada importação fica registrada com arquivo e data e pode ser desfeita inteira, sem deixar registros soltos.
5. Conferir na tela, com a Ather, se os totais batem com o relatório do Quintal de Casa.

## Detalhes técnicos
- Migração: adicionar `tipo text not null default 'despesa'` em `expense_detail_items`, com um gatilho que só aceita receita/despesa (igual ao Quintal de Casa). Adicionar colunas de rastreio que podem ficar vazias (`origem_upload_id`, `source_file`, `imported_at`).
- Não copiar a migração do Quintal de Casa que liga o recurso em todas as empresas. Aqui, só um ajuste pontual nas duas empresas, registrado em `audit_log`.
- Copiar do Quintal de Casa `useExpenseDetail.ts` (com `tipo`, `ensureGroup`, `fetchAllRows`) e `DetalhamentoDespesas.tsx`, ajustando para os componentes e as permissões deste projeto.
- Importação com conferência e registro em `upload_records`. Ao excluir a importação, os itens vinculados são removidos juntos.

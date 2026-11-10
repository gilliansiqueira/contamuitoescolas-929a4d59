# Cuiabá Goiabeiras: tirar de DL o que não é DL

## O que encontrei
- O arquivo original do Omni não fica guardado na plataforma, só as linhas importadas. Mas cada linha guarda a descrição, e no Omni a descrição já começa pela categoria (ex.: "Salário Instrutores - Bianca…", "Propaganda", "Obras - PF"). Isso basta para corrigir.
- Outubro (único mês importado do Omni) tem 97 linhas em DL (R$ 80.390,42). Até setembro (Sponte), DL tinha só gastos pessoais (PF), Distribuição de Lucro e Consórcio, que é a regra de Goiabeiras.
- Entre elas há 6 pagamentos repetidos (só o nome + "Salário Instrutores – nome", mesmo dia e valor): Bianca, Felipe, Pedro, Vyctoria, Wellington e Yasmim.

## O que vou fazer
1. **Corrigir outubro**, usando a categoria do começo da descrição e as regras que Goiabeiras já usava:
   - Continuam em DL: tudo que termina em "- PF", Pró-labore da Ilda/Aly, Distribuição de Lucro, Consórcio, "Banco Brasil" do consórcio (igual era antes).
   - Vão para a categoria certa: Salário Instrutores, Salário Recepção, Salário Coordenação, Pró-Labore (Maria Alice e geral), Propaganda, Mídias Sociais, Tarifas Bancárias, Taxa Cartão, Materiais de Escritório, Material para obra e Conservação e Manutenção (sem PF) → Conservação/Melhorias, Adiantamento → Empréstimo Funcionários, Verbas Rescisórias, Vale Transporte.
   - Apago 1 linha de cada um dos 6 repetidos (fica a de salário). Outubro de despesas cai R$ 13.296,63.
   - Antes de gravar, te mostro a lista linha a linha (de → para) e os totais por categoria antes e depois.
2. **Deixar resolvido para os próximos meses**: na importação de contas pagas, quando a linha vier como DL (ou sem categoria reconhecida) e a descrição começar com uma categoria conhecida, usar essa categoria — exceto "- PF", que segue DL. Também salvo as regras novas de Goiabeiras para os próximos uploads.
3. **Aviso de repetidos**: na conferência do upload, avisar quando vier uma linha só com o nome no mesmo dia e valor de uma linha "Categoria - nome", para não duplicar de novo.

Se outubro já estiver fechado, peço para reabrir antes de gravar.

## Detalhes técnicos
- Dados: `realized_entries` de Goiabeiras, `origem_arquivo = contas pagas Goiabeiras -2026-11-10.xlsx`; atualização de `conta_nome`/`conta_id` via comando de dados, com prévia antes.
- Regras: novas linhas em `category_rules` (match_field `categoria`).
- Importador: fallback por prefixo da descrição (texto antes de " - ") em `ImportacaoRealizado.tsx` usando `matchCategory`; teste novo cobrindo "Salário Instrutores - X" → Salário Instrutores e "Obras - PF" → DL.

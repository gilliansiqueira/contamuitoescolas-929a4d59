# Centro de Custos — aceitar o relatório "Contas pagas" como foi exportado

## O que está errado (confirmado)
O campo "Colar" do Centro de Custos espera as colunas nesta ordem:
**centro de custo, data, descrição, tipo, valor**.

A planilha `contas_pagas_15.xlsx` (954 linhas, jan a set/2026) vem em outra ordem:
**Data de pagamento, Nome, Categoria, Centro de Custo, Valor, Banco**.

Por isso o sistema leu "02/01/2026" como centro de custo e "ITAÚ PJ" como data, e avisou "data inválida". Nenhum dado foi gravado.

## O que vou fazer
1. Reconhecer automaticamente esse layout de "Contas pagas" (pelo cabeçalho ou quando a 1ª coluna for uma data), sem mudar o layout atual que já funciona.
2. Mapear as colunas:
   - Centro de custo ← "Centro de Custo" (linhas "Sem Centro de Custo Definido" entram nesse grupo, para o total bater com a planilha)
   - Data ← "Data de pagamento"
   - Descrição ← "Nome — Categoria"
   - Tipo ← Despesa (é relatório de contas pagas); valor guardado sem o sinal de menos
   - Banco ← ignorado nesta tela
3. Antes de salvar, a conferência na planilha mostra a quantidade de linhas e o total, igual ao total da planilha original, com as linhas por mês — cada linha fica no mês da própria data.
4. Mensagens de erro passam a dizer qual coluna era esperada e o que foi encontrado.

## O que não muda
Nenhuma outra tela, relatório, Dashboard ou lançamento existente. Sem alterações no banco de dados.

## Detalhes técnicos
- `src/components/realizado/DetalhamentoDespesas.tsx` → `parseSpreadsheet`: detectar o cabeçalho "data de pagamento"/"centro de custo" ou data em `parts[0]` e remapear os índices; pular a linha de cabeçalho.
- Teste novo com as primeiras linhas reais da planilha (ordem, total e meses).

# Pendências: filtro Receita/Despesa e Excel para o cliente

Na tela de Movimentações do Fluxo Bancário (onde já existe "Só pendentes").

## O que muda
1. **Novo filtro "Tipo"** ao lado do filtro de status: Todos / Entradas (receitas) / Saídas (despesas). Funciona junto com período, conta, busca e valor. Os totais do rodapé (conciliados, pendentes) passam a refletir o filtro.
2. **Novo botão "Exportar pendências p/ cliente"** que gera um Excel só com os lançamentos pendentes do filtro atual:
   - Colunas: Data, Conta, Descrição, Tipo (Entrada/Saída), Valor, Motivo da pendência (se justificada), Observação, e uma coluna em branco **"Retorno do cliente"** para eles preencherem.
   - Cabeçalho com nome da empresa e período; total de entradas e saídas pendentes no fim.
   - Sem colunas internas (status, ids, categorias do modelo).
   - Nome do arquivo: `Pendencias_<empresa>_<periodo>.xlsx`.
3. O "Exportar Excel" atual continua igual.

## Detalhes técnicos
- `BankTransactionsTable.tsx`: estado `tipoFilter` aplicado em `rows`; novo `exportPendencias()`.
- Nova função em `src/lib/bankStatements/exportPendencias.ts` reaproveitando a lib de xlsx já usada em `exportMovements`.
- Classificação usa só `t.tipo` do extrato (sentido do dinheiro no banco) como filtro visual — nenhum cálculo financeiro é alterado.

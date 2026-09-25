# Verificação do total de seleção na Conciliação

## Estado atual

A melhoria da barra de totais de seleção na Conciliação já está implementada em `src/components/fluxo-bancario/BankTransactionsTable.tsx` e a compilação está OK. Só falta verificar na tela com a conta de administradora.

## Etapas

1. Solicitar o acesso de teste com a conta de administradora (adm@contamuito) para abrir o preview autenticado. Isso é apenas uma sessão de teste para mim — não cria nem altera nada no sistema nem para outros usuários.
2. Abrir Fluxo Bancário → Movimentações (conciliação) de Dourados no preview.
3. Marcar lançamentos variados (conciliado, pendente, não se aplica) e confirmar que:
   - a barra "Selecionados" aparece com quantidade e total em R$;
   - os subtotais de Conciliados / A conciliar / Não se aplica batem com as linhas;
   - a barra atualiza ao marcar/desmarcar e some ao limpar a seleção;
   - depois de "Conciliar selecionados" a barra é limpa e os totais do período se atualizam.
4. Reportar o resultado com captura de tela.

# Cristo Rei — alunos "sem parcelas de módulo"

Sim, dá para conferir e atualizar. Preciso que você mande o **Contas a Receber do Sponte** com vencimentos **anteriores a 01/10/2026**, incluindo as parcelas já pagas.

## O que vou fazer quando o arquivo chegar
1. Ler o arquivo e cruzar com os 62 alunos que hoje aparecem sem parcela de módulo, pela matrícula e, se não houver, pelo nome igual.
2. Separar o resultado em 3 grupos:
   - **Pagou à vista:** tem um pagamento de módulo único antes de 01/10.
   - **Tem parcelas:** as parcelas estavam só no período antigo. Nesse caso, a "Venc. última parcela" passa a ser preenchida.
   - **Sem nada no arquivo:** continua na Conferência para a equipe decidir.
3. Juntar esse arquivo ao Contas a Receber que já está no sistema, sem apagar o atual e sem contar a mesma parcela duas vezes.
4. Recalcular a planilha do Cristo Rei. O que a equipe já preencheu fica como está.
5. Mandar a lista com cada aluno e o grupo em que ele caiu.

## Detalhes técnicos
- Juntar os dois relatórios `contas_receber` de forma que o mesmo aluno + parcela + vencimento conte uma vez só.
- Um pagamento à vista de módulo conta como parcela de módulo. Assim o aviso "sem parcelas" deixa de aparecer para esse aluno.
- Isso não muda nenhum cálculo financeiro: a Renovação é separada.

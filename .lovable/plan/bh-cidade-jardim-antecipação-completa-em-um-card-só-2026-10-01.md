# BH Cidade Jardim: antecipação completa em um card só

## Causa (conferida nos dados)
O card **Antecipação** soma R$ 65.246,79. Os R$ 4.866,74 que faltam estão em um lançamento de 14/09 que foi dividido em partes. A parte "Antecipação" ficou como Operação, mas sem a subcategoria escolhida na segunda caixa. Por isso foi para o card genérico, que somado dá os R$ 70.113,53.

O mesmo lançamento dividido tem outras duas partes nessa situação:
- **Compra da Escola:** R$ 14.000,00
- **Distribuição de Lucros:** R$ 4.000,00

É esse o aviso "Partes de operação (2)" que aparece no topo do Fluxo Bancário.

## O que fazer
1. Escolher a subcategoria nas três partes, usando o nome que já está escrito em cada uma: Antecipação, Compra da Escola e Distribuição de Lucros. A alteração fica registrada no histórico.
2. Com isso, o card Antecipação passa a mostrar **R$ 70.113,53**, e cada uma das outras duas partes ganha o seu próprio card.
3. Para não repetir: ao dividir um lançamento, a parte marcada como Operação já vem com a subcategoria preenchida quando o nome digitado for igual a um item do modelo.
4. Aviso para obrigar o preenchimento correto:
   - Ao marcar "Operação" sem escolher a subcategoria, aparece a mensagem "Escolha a subcategoria da operação".
   - A caixa fica destacada em amarelo, tanto no lançamento inteiro quanto em cada parte de um lançamento dividido.
   - O botão de conciliar o lançamento fica travado até a subcategoria ser escolhida.
   - "Finalizar conciliação do dia" também fica travado e lista as operações sem subcategoria.
   - A prévia de ativação continua mostrando o aviso.

Resultado, saldo e totais não mudam.

## Detalhes técnicos
- Dados: chamar `set_bank_split_model_item` nos 3 splits, buscando o item do modelo da escola pelo nome normalizado, e depois rodar `sync_bank_cashflow_school`.
- Código: em `set_bank_tx_splits` (no frontend, antes de enviar), quando `categoria=operacao`, sem `model_item_id` e com descrição igual ao nome de um item de operação, preencher o `model_item_id`.

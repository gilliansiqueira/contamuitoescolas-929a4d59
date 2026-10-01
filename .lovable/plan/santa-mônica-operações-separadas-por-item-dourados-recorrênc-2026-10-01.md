# Santa Mônica: operações separadas por item + Dourados (recorrência)

## Santa Mônica: causa confirmada no código
- No Fluxo Bancário, cada operação está salva certinho com o seu item: Pró-Labore, Saída Aporte ou Saída Empréstimo.
- O problema está no Dashboard. Para agrupar os cards, ele usa uma "chave" de cada lançamento. Nas operações do banco, essa chave acaba virando só "saída" para todas elas. Por isso caem num único card, que fica com o nome do primeiro item (Pró-Labore) e soma R$ 62.261,31.
- O Resultado e o saldo estão certos. O erro é só no agrupamento e nos nomes dos cards.

### Correção
1. Cada item escolhido no Fluxo Bancário vira o seu próprio card: Pró-Labore, Saída Aporte e Saída Empréstimo, cada um com o seu valor. Vale para todas as empresas, incluindo Foz.
2. Criar um teste automático com três operações de itens diferentes, conferindo que ficam em três grupos.
3. Resultado, Saldo final e totais não mudam.

## Dourados: recorrência (sem mudança de cálculo)
- A planilha entrou inteira: 259 linhas, R$ 109.415,95.
- A Recorrência Sponte Pay e o Cartão de Crédito têm prazo de 30 dias, que você confirmou como correto. Por isso, o que vence em outubro aparece em novembro.
- Ajuste opcional só na tela: em Recebíveis, mostrar o vencimento original ao lado da data de recebimento, por exemplo "vence 05/10 → recebe 04/11".

## Detalhes técnicos
- `ledgerEngine.resolveEntryTipoKey`: quando `tipoOriginal` começar com `'Operação (banco): '`, retornar o próprio `tipoOriginal`. Hoje o fallback cai em `tipo` ('saida'), que está em DEFAULT_MAPPINGS, e todas as operações compartilham a chave em `periodMovement.ensureKey`.
- Novo caso em `bankOverlayOperacao.test.ts`.
- `Receivables.tsx`: exibir `dataOriginal` quando for diferente de `dataProjetada`.

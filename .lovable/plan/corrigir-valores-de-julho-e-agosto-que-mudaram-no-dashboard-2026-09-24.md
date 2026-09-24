# Corrigir valores de julho e agosto que mudaram no Dashboard

## O que já foi conferido
- Os lançamentos de junho, julho e agosto de Uberlândia Santa Mônica **não foram alterados** no banco. O último registro de agosto foi criado em 02/09 e o de julho em 05/08.
- Boa Vista ainda usa a planilha e não foi ligada ao Fluxo de Caixa. Mesmo assim, os valores dela também mudaram.
- Isso indica que os dados estão intactos e que o problema está na **forma de carregar ou somar** os lançamentos, e não em algo que foi apagado.

## Suspeitas (ainda não confirmadas)
1. **Mudança recente de velocidade:** a leitura dos lançamentos passou a ser feita em partes e com menos colunas. Isso pode ter deixado linhas de fora, repetido linhas ou retirado alguma informação usada na classificação (por exemplo, o tipo ou a categoria).
2. **Ajustes do Fluxo de Caixa em Santa Mônica:** as regras de saldo inicial pelo banco e de Ignorar podem estar alcançando meses anteriores a setembro. Isso não explica Boa Vista, mas pode somar uma diferença extra em Santa Mônica.

## Etapas
1. **Medir a diferença:** calcular direto no banco o resultado esperado de julho e agosto das duas empresas e comparar com as imagens enviadas. Referências de Santa Mônica em agosto: Receitas R$ 94.182,23, Despesas R$ 68.829,28, Saldo final R$ 28.175,55.
2. **Ver o que a tela está carregando:** abrir o Dashboard como administradora e comparar a quantidade e a soma das linhas carregadas com o banco. O objetivo é apontar exatamente quais lançamentos faltam, estão repetidos ou foram classificados errado.
3. **Corrigir a causa:**
   - Se for a leitura em partes: corrigir a ordem ou a paginação, ou voltar ao método anterior.
   - Se forem colunas faltando: devolver as colunas necessárias.
   - Se for o Fluxo de Caixa: limitar as regras a 01/09/2026 em diante.
4. **Verificar em todas as empresas:** comparar julho e agosto de todas as empresas com os relatórios gerados antes da mudança (06/2026 a 08/2026) e listar qualquer uma que ainda não bata.
5. **Confirmar na tela:** Santa Mônica (julho e agosto) e Boa Vista precisam mostrar exatamente os valores das imagens.

## Garantias
- Nenhum lançamento será alterado, apagado ou reimportado.
- Junho, julho e agosto continuam congelados.
- Os cálculos oficiais do sistema não serão duplicados.

## Detalhes técnicos
- Principais suspeitos: `src/lib/fetchAll.ts` (paginação por chave, reordenação em JS) e `ENTRY_COLS` em `useFinancialData.ts`.
- Também serão revisados `bankCashflowOverlay.ts` e o corte por `start_month`.
- Validação: somas feitas no banco comparadas com a quantidade e a soma de linhas carregadas no cliente, pelo Playwright.

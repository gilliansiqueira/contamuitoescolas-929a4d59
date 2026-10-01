# Dourados: planilha de recorrência

## O que foi conferido nos dados
- A planilha entrou inteira no sistema: 259 linhas, R$ 109.415,95, o mesmo total do arquivo.
- Em outubro aparecem Boleto (R$ 16.023,60), PIX (R$ 6.639,99) e os cheques da planilha. O card Cheque, com R$ 17.024,53, já soma os R$ 3.098,00 de cheques que vieram da planilha.
- A Recorrência Sponte Pay e o Cartão de Crédito têm prazo de 30 dias. Esse prazo é a regra cadastrada para Dourados e foi confirmado como correto. Por isso, o que vence em outubro cai em novembro: R$ 2.516,80 de recorrência e R$ 1.692,50 de cartão.
- Não foi encontrado nenhum valor perdido nem duplicado.

## Ajuste proposto (só na tela, para a equipe entender)
1. Em Recebíveis, mostrar ao lado de cada linha também o vencimento original, quando houver prazo aplicado. Exemplo: "vence 05/10 → recebe 04/11".
2. No topo de Recebíveis, mostrar um aviso com o valor que venceu no mês, mas só será recebido no mês seguinte por causa do prazo. Exemplo: "R$ 4.209,30 vencem em out/2026 e entram em nov/2026 pelo prazo de recebimento".

Nenhum cálculo muda. Simulação, Fluxo Diário e Dashboard continuam usando a mesma data de recebimento.

## Detalhes técnicos
- `Receivables.tsx`: usar `dataOriginal` quando for diferente de `dataProjetada`. Para o aviso, somar as receitas projetadas com `dataOriginal` no mês escolhido e `dataProjetada` fora dele, vindas de `useProjectedEntries` (SSOT).

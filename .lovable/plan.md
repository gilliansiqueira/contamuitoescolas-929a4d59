# Operações com subcategoria em todas as empresas

## Já está valendo para todas
A correção de Santa Mônica não é só dessa empresa. Toda operação que tem um item escolhido na segunda caixa do Fluxo Bancário já aparece no Dashboard como um card próprio, com o nome desse item (Pró-Labore, Saída Aporte, Antecipação...). Falta só publicar para chegar no site.

## O que ainda falta: operações sem item escolhido
Algumas operações estão marcadas como "Operação", mas sem item na segunda caixa. No Dashboard, elas aparecem como o card genérico "Operações (banco)". Quantidade por empresa:
Jurassic 62, Clínica Aniella 48, Fazenda Rio Grande 23, Morada do Sol 23, Cuiabá Goiabeiras 21, Chapecó 16, Palmital 15, Foz do Iguaçu 12, Uberlândia Centro 12, SJP 10, Linhares 9, Indaiatuba 8, Boa Vista 8, Santa Mônica 8, e mais 16 empresas com até 6 cada.

O sistema não pode escolher o item sozinho, porque um Pix enviado tanto pode ser Pró-Labore quanto Aporte. Proposta:

1. No Fluxo Bancário, ao marcar "Operação", a segunda caixa fica destacada em amarelo com "Escolha a subcategoria" enquanto estiver vazia.
2. No quadro "O que falta para liberar o botão" da ativação, incluir um aviso: "X operações sem subcategoria". O aviso só informa e não bloqueia a ativação.
3. No Dashboard, o card genérico passa a se chamar "Operações sem subcategoria", para a equipe saber que falta classificar.
4. A equipe escolhe o item nos lançamentos da lista acima. Cada um vai virando o seu próprio card automaticamente.

Nada muda em Resultado, saldo ou totais.

## Detalhes técnicos
- `bankCashflowOverlay`: trocar o rótulo de fallback 'Operações (banco) - entrada/saída' por 'Operações sem subcategoria - entrada/saída'.
- Destaque visual no seletor de item do modelo da linha de movimentação quando `categoria=operacao` e o item estiver vazio.
- `ActivationPreview`: somar a contagem de operações sem item na lista de pendências, apenas como aviso.

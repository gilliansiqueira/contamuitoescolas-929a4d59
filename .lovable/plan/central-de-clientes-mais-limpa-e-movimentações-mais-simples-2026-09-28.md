# Central de Clientes mais limpa e Movimentações mais simples

## 1. Central de Clientes
- Clicar na linha da empresa (no nome ou em qualquer parte) abre a empresa. O botão "Abrir" sai da lista.
- Na ponta direita de cada linha entra um botão de três pontinhos (⋯), visível só para você. Dentro dele fica **Inativar empresa**, que continua pedindo confirmação.
- Na lista agrupada por responsável, clicar na empresa também abre direto.
- Em "Empresas inativas", clicar no nome abre a empresa. **Reativar** passa para os três pontinhos.

## 2. Movimentações: menos opções
- **"Não se aplica" some** dos botões, do menu de cada linha, do filtro de Situação e do resumo. Nenhum lançamento usa essa opção hoje.
- As ações ficam em uma barra que só aparece quando há lançamentos selecionados, com três grupos:

```text
[ ✓ Conciliar (19) ]  [ Justificar ]  [ Classificar como ▾ ]         [ Desfazer ▾ ]
                                        Receita/Despesa normal         Voltar a pendente
                                        Operação                      Tirar de Operação
                                        Transferência entre contas    Tirar de transferência
                                        Ignorar
```

- **Conciliar** é o botão principal, em laranja. **Justificar** fica ao lado dele.
- **Classificar como** junta, em um único menu, as opções que hoje são quatro botões soltos.
- **Desfazer** junta "voltar a pendente", "tirar de operação" e "tirar de transferência", para não serem clicados sem querer.
- Com nada selecionado, aparecem apenas os filtros e o resumo: Conciliados e Pendentes.

## 3. Total cruzado dos selecionados
A faixa laranja dos selecionados passa a mostrar:

```text
Selecionados: 19  ·  Entradas R$ 27.673,47 (8)  ·  Saídas R$ 27.673,47 (11)  ·  Diferença R$ 0,00  ✓ batem
```

- **Diferença** = entradas − saídas. Quando dá zero, o texto fica verde com "batem", o que ajuda a conferir ignorados, transferências e estornos.
- Quando não bate, mostra o valor que sobra e de que lado: "sobra R$ 500,00 em saídas".
- Continua mostrando quantos lançamentos estão a conciliar e quantos já estão conciliados.
- O mesmo cruzamento aparece no resumo do filtro atual, mesmo sem nenhum lançamento selecionado.

## O que não muda
Nenhum valor, saldo, classificação ou lançamento muda. A mudança é só na forma de mostrar e de clicar.

## Detalhes técnicos
- `ManagementCenter.tsx`: a linha inteira fica clicável (`role="button"`, `onClick` que chama `openSchool`, Enter/Espaço pelo teclado). O `DropdownMenu` (MoreHorizontal) usa `stopPropagation` para não abrir a empresa junto e contém Inativar/Reativar, só para `isSuperAdmin`.
- `BankTransactionsTable.tsx`:
  - remover `nao_se_aplica` da UI (filtro, resumo, dropdown, botão); o tipo continua existindo, sem migration;
  - reorganizar a barra de ações em Conciliar, Justificar, `DropdownMenu` "Classificar como" (reaproveitando `setCategory`) e `DropdownMenu` "Desfazer";
  - calcular `selIn`, `selOut` e `diff` a partir de `selRows`, pelo sentido do lançamento no extrato (conferência de soma, não classificação financeira), e o mesmo para `rows`.
- Testar na prévia: selecionar ignorados que se anulam, conferir que aparece "batem", e conferir que clicar na empresa abre e que os três pontinhos não abrem a empresa.

# Fluxo Bancário: aplicação automática visível e fácil de corrigir

## Situação atual
- A pré-marcação na importação já existe. Quando a conta tem aplicação automática ligada, as linhas reconhecidas pelo texto (ex.: "BB RENDE FÁCIL") já entram marcadas como aplicação ou resgate.
- A linha "some" porque, depois de marcada, fica escondida até alguém ligar "Mostrar aplicações automáticas". Por isso é difícil achar e corrigir um clique errado.

## O que muda
1. **As linhas de aplicação não somem mais.** Elas continuam na lista, em tom mais claro e com o selo "Aplicação automática" ou "Resgate automático". Quem quiser pode esconder com a opção "Esconder aplicações automáticas".
2. **Desfazer na hora.** Ao marcar ou desmarcar uma linha como aplicação, aparece um aviso com o botão "Desfazer", que dura alguns segundos.
3. **Corrigir depois.** Pela coluna Categoria:
   - Nas linhas de aplicação, aparece "Aplicação automática" no lugar do traço.
   - Dá para trocar direto para Entrada/Saída, Operação ou Ignorar.
   - O filtro Categoria → "Aplicação automática" lista todas para conferir.
4. **Conferir o que foi pré-marcado.** A tela da importação mostra "X linhas pré-marcadas como aplicação automática", com um botão "Ver" que abre a lista já filtrada.
5. Toda correção continua registrada no histórico da linha. O saldo total não muda, só a divisão entre Em conta e Aplicado.

## Detalhes técnicos
- `BankTransactionsTable.tsx`:
  - `showAuto` passa a ser `true` por padrão, e o texto do botão muda para "Esconder aplicações automáticas".
  - As linhas com `isAutoInvest` ganham `opacity-70`.
  - O Select de categoria passa a incluir as opções `auto_aplicacao` e `auto_resgate`, conforme o sentido da linha. Linhas de transferência interna continuam sem Select.
  - O toast de `setKind` guarda o `movement_kind` anterior de cada id e oferece a ação "Desfazer", que chama `useSetMovementKind` com o valor anterior.
  - Recebe um filtro inicial opcional por `import_id` e categoria.
- `BankAccountsImports.tsx`: depois da importação, e na lista de extratos, conta as linhas pré-marcadas e mostra o botão "Ver", que muda para a aba Movimentações com o filtro aplicado.
- `FluxoBancario.tsx`: controla a aba ativa e o filtro inicial repassado para a tabela.
- Não há mudança no banco de dados. O histórico de categoria já é gravado.

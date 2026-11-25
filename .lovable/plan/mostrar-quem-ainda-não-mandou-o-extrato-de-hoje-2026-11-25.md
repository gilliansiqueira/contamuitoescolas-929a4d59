# Mostrar quem ainda não mandou o extrato de hoje

## O que acontece hoje
A Central de Clientes abre na aba **Ontem**. Nessa aba, o quadro "Extrato não enviado" conta só quem não mandou o extrato de ontem. Por isso apareciam só 3 empresas: OAP, Maracaju e Lauro de Freitas. A aba **Hoje** já conta quem falta hoje, mas ela fica escondida atrás de um clique.

## O que muda
1. **Na aba Ontem**, logo abaixo do quadro "Extrato não enviado", aparece uma linha extra: **"Hoje ainda faltam X — ver"**.
   - O clique leva para a aba Hoje, já filtrada em "Extrato não enviado".
   - A linha some quando todas as empresas já mandaram o extrato de hoje.
2. **Título do quadro mais claro:** na aba Ontem, o quadro passa a se chamar "Extrato de ontem não enviado". Na aba Hoje, "Extrato de hoje não enviado".
3. A conta de quem falta hoje segue a mesma regra da aba Hoje:
   - entram só as empresas com conta bancária cadastrada e já dentro do mês de início;
   - empresas inativas e restritas continuam fora, como já é hoje.

Nada muda em saldos, conciliação ou cálculos financeiros. É só a forma de mostrar.

## Detalhes técnicos
- `ManagementCenter.tsx`: a busca do status diário de hoje (`useManagementDailyStatus(today)`) passa a rodar também na aba Ontem. A contagem usa o mesmo `dailyReconState(...) === 'no_statement'` com `bankAvailable`.
- O link chama `setMode('hoje')` e `setCardFilter('no_statement')`.
- Os títulos dos quadros mudam em `cardDefsFor`.
- Fica de fora o aviso das 15h30 (`AfternoonBankCheck`), que já usa o dia atual.

## Botões "Hoje" e "Dia anterior" no topo
- Ao trocar de botão, tudo na Central passa a usar o dia escolhido: os quadros, a contagem de extratos não enviados, a lista por empresa, as bolinhas e a barra de conciliação.
- **Primeiro passo:** abrir a Central e clicar nos dois botões, para achar o que hoje não muda junto. Isso será corrigido para seguir o dia escolhido.
- Depois de ajustar, confiro de novo: em "Hoje" o quadro precisa mostrar as cerca de 29 empresas que ainda faltam, e em "Dia anterior", as 3.

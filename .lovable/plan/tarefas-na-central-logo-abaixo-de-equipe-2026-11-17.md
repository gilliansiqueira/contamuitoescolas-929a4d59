# Tarefas na Central, logo abaixo de "Equipe"

## Situação atual
A aba Tarefas foi colocada no menu "Operação" que aparece só depois de entrar em uma empresa. Por isso não aparece na Central de Clientes.

## O que muda
- Na Central de Clientes, no menu lateral, aparece um novo item **Tarefas** logo abaixo de "Equipe" (como item próprio, não dentro da tela Equipe).
- No celular, o botão "Tarefas" entra na barra de cima, ao lado de "Equipe".
- Continua visível só para você, Isa, Ana e Gisele (mesma permissão de hoje). Hoje o título "Equipe" no menu só aparece para você; Isa, Ana e Gisele também vão ver "Tarefas" nesse mesmo espaço.
- A tela é a mesma de hoje: Minhas / Todas / Concluídas, filtros por pessoa e empresa, comentários.
- O item Tarefas sai do menu "Operação" de dentro das empresas, para não ficar em dois lugares.

## Detalhes técnicos
- `ManagementCenter.tsx`: nova view `mgmt_tasks` renderizando `<MgmtTasks />`; item no aside abaixo do botão Equipe e na nav mobile, condicionado a `can_use_mgmt_tasks()` (RPC já existente).
- `Index.tsx`: remover `mgmt_tasks` do grupo Operação e do `mainTabs`.
- Sem mudança no banco nem nas regras de acesso.

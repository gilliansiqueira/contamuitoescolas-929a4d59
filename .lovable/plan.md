# Liberar a Thau para ver as outras carteiras

## Situação atual
- A Thau (thau@contamuito.com) é administradora com acesso **somente às empresas da lista dela** (6 empresas). Por isso, ao clicar em outras carteiras, as escolas não aparecem.

## O que muda
- Trocar o acesso da Thau de "só a lista" para **"todas as empresas"** — o mesmo ajuste que existe na tela de Usuários.
- Ela passa a abrir e trabalhar nas escolas das outras carteiras.

## O que NÃO muda
- A carteira dela continua sendo só as 6 empresas em que é responsável.
- A barra vermelha de atrasos e os avisos do Meu Dia continuam mostrando só a carteira dela.
- Empresas restritas continuam invisíveis para ela (só super administradoras veem).
- Ela não ganha poderes de proprietária (gerenciar usuários, permissões).

## Detalhes técnicos
- Executar `set_collaborator_scope('9abbf168-a133-409b-b20a-3036d2a325a2', 'all')` (atualiza `profiles.admin_scope`).
- Conferir depois que `admin_scope = 'all'`. Ela precisa sair e entrar de novo para atualizar.

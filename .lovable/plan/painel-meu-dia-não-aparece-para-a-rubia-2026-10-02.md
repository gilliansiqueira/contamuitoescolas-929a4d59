# Painel "Meu dia" não aparece para a Rubia

## Diagnóstico (já confirmado)

- O painel "Meu dia" **não é exclusivo do acesso da Bruna**: ele aparece no topo da Central de Clientes para qualquer pessoa da equipe (admin), mostrando as empresas em que ela é a responsável.
- A Rubia é admin e tem 4 empresas marcadas como responsável: **Dourados, Fazenda Rio Grande, Manaus Laranjeiras e Sinop**.
- Pelo código, o painel deveria aparecer para ela. A causa mais provável é ela ter aberto o sistema **antes da publicação mais recente terminar de propagar**, ou estar com a versão antiga guardada no navegador.

## O que fazer

1. **Verificar no ar**: entrar no site publicado com o acesso da Rubia e confirmar se o painel "Meu dia — Rubia" aparece no topo da Central com as 4 empresas dela.
2. **Se não aparecer**: investigar a causa real (versão publicada desatualizada, erro silencioso no carregamento dos dados dela) e corrigir.
3. **Se aparecer**: apenas orientar a Rubia a atualizar a página (Ctrl+F5 / Cmd+Shift+R) para carregar a versão nova.

## Detalhes técnicos

- Teste via navegador automatizado no endereço publicado (relatorioscontamuito.online), restaurando sessão da Rubia (user_id 6327d1d3-ff6e-48e7-90cc-c31f988c4cd8).
- Confirmar que `useMyDay` carrega sem erro para as 4 empresas dela e que os cartões renderizam.
- Nenhuma mudança de regra financeira envolvida.

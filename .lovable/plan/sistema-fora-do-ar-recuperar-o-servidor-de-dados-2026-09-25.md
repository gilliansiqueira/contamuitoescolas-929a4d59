# Sistema fora do ar — recuperar o servidor de dados

## O que foi verificado
- O site oficial e o preview abrem normalmente (as páginas carregam).
- O servidor de dados (login e lançamentos) não responde: a verificação de saúde ficou 20 segundos sem resposta. Por isso o sistema parece "fora do ar" — a tela abre, mas nada carrega nem deixa entrar.
- Nenhum erro no código do app.

## O que vou fazer
1. Consultar a saúde do servidor de dados (memória, conexões, consultas travadas) para registrar a causa.
2. Reiniciar o servidor de dados. Isso não apaga nem altera nenhum lançamento; leva alguns minutos e o sistema volta sozinho.
3. Se a causa for falta de capacidade (memória ou conexões no limite), avisar e sugerir aumentar o tamanho do servidor — isso tem custo, então só faço com a sua aprovação.
4. Conferir que o login e o Dashboard voltaram a carregar, entrando com a conta de administradora.

## Detalhes técnicos
- Diagnóstico: `supabase--cloud_status` = backend_unreachable_db; `/auth/v1/health` timeout.
- Ações: `supabase--db_health` e `supabase--slow_queries` (leitura), depois `supabase--restart`; aguardar `cloud_status` saudável; teste Playwright com sessão admin.
- Nenhuma migration, nenhum dado financeiro tocado.

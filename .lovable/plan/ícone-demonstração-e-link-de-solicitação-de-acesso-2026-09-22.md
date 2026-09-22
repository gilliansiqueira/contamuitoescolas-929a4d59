# Ícone, demonstração e link de solicitação de acesso

Três ajustes pedidos: voltar ao ícone com a marca Conta Muito, fazer a demonstração abrir de verdade e transformar o aviso "Não possui acesso?" em um link para o formulário.

## 1. Ícone do aplicativo

Substituir os ícones atuais (fundo grafite com "CM" e linha verde-água) por versões geradas a partir da própria logo da Conta Muito, centralizada sobre fundo branco suave com margem confortável.

Arquivos atualizados: ícone do app (512 e 192), ícone da tela de início do iPhone e o favicon da aba do navegador.

## 2. "Conheça por dentro" nunca abre

Causa confirmada: ao abrir a demonstração sem estar logada, a consulta da lista de empresas é recusada pelo banco (erro de permissão em uma regra de acesso de administrador que também é avaliada para visitantes). A tela fica presa em "Carregando demonstração..." para sempre, porque não existe tratamento de erro.

Correções:
- Ajustar as regras de acesso da tabela de empresas para que as regras de administrador sejam avaliadas apenas para usuários autenticados, mantendo a regra pública que libera somente a empresa de demonstração. Nenhum dado real fica exposto: visitantes continuam vendo apenas a empresa "Demo".
- Adicionar tempo limite e mensagem de erro na tela de demonstração, com botão "Tentar novamente", para nunca mais ficar em carregamento infinito.
- Validar abrindo /demo no navegador e conferindo que os números da empresa Demo aparecem.

## 3. "Não possui acesso? Fale com o administrador"

Transformar em link clicável para https://form.respondi.app/jshTVcft, abrindo em nova aba, com estilo em laranja e o mesmo texto.

## Detalhes técnicos

- `public/app-icon-512.png`, `public/app-icon-192.png`, `public/apple-touch-icon.png`, `public/favicon.png` regerados a partir de `src/assets/logo-conta-muito.png`.
- Migration: recriar as políticas `View own school or admin`, `Admin manage schools update/delete/insert` de `public.schools` com `TO authenticated`; manter `demo_select_schools` para `anon, authenticated` com `is_demo_school(id)`. Sem alterar `is_admin()` nem conceder execução ao papel anônimo.
- `src/pages/Demo.tsx` / tela de carregamento: estado de erro com retry após timeout.
- `src/pages/Auth.tsx`: o texto vira `<a href target="_blank" rel="noreferrer">`.

Nada de cálculos, motores financeiros, relatórios ou dados é alterado.

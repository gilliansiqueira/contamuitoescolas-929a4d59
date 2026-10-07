# Adicionar "Esqueci minha senha" na tela de login

## Objetivo
Permitir que usuários (como a Gisele) redefinam a senha sozinhos, sem precisar do administrador.

## O que será feito

1. **Link "Esqueci minha senha" na tela de login** (`src/pages/Auth.tsx`)
   - Link abaixo do campo de senha.
   - Ao clicar, pede o e-mail e envia um link de redefinição para o e-mail informado.

2. **Página de redefinição de senha** (nova rota, ex.: `/redefinir-senha`)
   - O usuário clica no link recebido por e-mail, cai nesta página e define a nova senha (com confirmação).
   - Após salvar, entra direto no sistema.

3. **E-mail de redefinição**
   - Usa o envio de e-mails do backend (Lovable Cloud). Se o modelo de e-mail padrão estiver em inglês, ajusto o texto para português.

## Detalhes técnicos
- `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origem>/redefinir-senha })`.
- Nova página detecta a sessão de recuperação (`type=recovery`) e chama `supabase.auth.updateUser({ password })`.
- Rota pública adicionada no roteador; nenhuma alteração em dados financeiros ou permissões.
- Sem cadastro novo: só quem já tem conta recebe o link.

## Verificação
- Testar o fluxo completo no navegador: pedir redefinição, abrir a página de nova senha e confirmar que o login funciona com a senha nova.

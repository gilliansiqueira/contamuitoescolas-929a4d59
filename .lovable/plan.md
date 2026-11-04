# Aviso de entrada + acesso total do Acy

## 1. Janela "Prazos de entrega" ao entrar
Problema: a janela não tem limite de altura. Em telas menores (ou com muitas empresas em atraso), ela passa do tamanho da tela, e o X e o botão "Entendi" ficam fora de alcance.

Correção:
- Limitar a janela à altura da tela, com rolagem só na lista do meio. Título, X e "Entendi" sempre visíveis.
- Mostrar primeiro um resumo curto (total em atraso e quantas pessoas responsáveis), com a lista por responsável recolhida. Quem quiser abre para ver os detalhes.
- Permitir fechar clicando fora da janela ou com a tecla Esc.
- Conferir a janela numa tela pequena (do tamanho da sua prévia) e numa tela de computador.

## 2. Acesso total do Acy (uma conta só)
Hoje existem duas contas:
- **acy@contamuito.com**: usada hoje, mas sem nenhum perfil de acesso.
- **acy@joinville.com**: conta de cliente da Joinville, nunca usada.

O que vou fazer:
- Dar a **acy@contamuito.com** o mesmo perfil de proprietária que o seu (acesso total), com registro no histórico de alterações.
- Apagar a conta **acy@joinville.com** e tirar ela das empresas em que estiver vinculada.

## Detalhes técnicos
- `TeamDeadlineNotice.tsx`: `DialogContent` com `max-h-[85vh] flex flex-col`, corpo com `overflow-y-auto` e rodapé fixo; lista por responsável recolhida por padrão.
- Função `super_admin` em `user_roles` para 4d08be23…; remover o usuário 2f38013a… (`user_schools`, `user_roles`, auth) pela função de gestão de usuários já existente; registrar no `audit_log`.

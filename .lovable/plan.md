# Inativar empresa (sem apagar histórico)

## O que muda para você
- Em cada empresa da Central de Clientes aparece a opção **Inativar** (e depois **Reativar**), com uma janela de confirmação.
- Uma empresa inativa:
  - **Não aparece para o cliente:** quem é cliente não consegue mais abrir os dados dela, e o bloqueio vale no servidor, não só na tela.
  - **Sai da carteira das meninas:** não entra nos cards, na porcentagem, no fechamento, nas pendências nem na contagem de empresas.
  - **Mantém todo o histórico:** nada é apagado. Administradores continuam vendo a empresa num filtro "Inativas" e podem reativá-la quando quiserem.
- Primeiro uso: Salvador Pituba e Campinas. Eu mesma faço a inativação depois de você aprovar, ou você faz pelo botão.

## Impacto em partes existentes (atenção)
- A regra que decide se um cliente pode ver uma empresa ganha uma condição a mais: a empresa precisa estar ativa. Isso só afeta clientes de empresas inativas. Administradores e empresas ativas não mudam.
- Nenhum lançamento, relatório ou saldo é alterado.

## Detalhes técnicos
- Migration aditiva: `schools.ativo boolean not null default true`, `inativado_em timestamptz null`, `inativado_por uuid null`; todas as empresas atuais continuam ativas.
- `user_has_school_access` passa a exigir `schools.ativo` para quem não é administrador (`is_admin()`/`is_platform_member()` continuam liberados).
- `get_management_portfolio` e `get_management_daily_status` / backlog filtram `ativo = true`.
- Frontend: `useSchools` expõe `ativo`; o seletor de empresas do cliente esconde as inativas; ManagementCenter ganha ação Inativar/Reativar e o filtro "Inativas"; registro em `audit_log`.

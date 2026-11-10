# Plano de integração — Acessos e senhas (NÃO PROMOVIDO)

Status: só protótipo. Nada aplicado em src/, migrations, funções, banco ativo ou permissões reais.

## Decisão de design (Bruna, 10/11/2026)
Toda a equipe operacional autorizada pode **consultar/usar** (ver com timer, copiar, abrir endereço)
acessos **comuns** de todas as carteiras. Isso **não** libera editar, não libera itens restritos,
não libera empresas restritas (`schools.restrita` / `can_see_school`) nem a auditoria.

## Matriz alvo
| Papel | Usar comuns | Usar restritos | Editar | Auditoria | Empresa restrita |
|---|---|---|---|---|---|
| Operacional (grupo) | todas as carteiras | não | não | não | não |
| Editor vinculado | todas | não | só empresas vinculadas (`_acc_edit`) | não | não |
| Administrador | sim | sim | sim | sim | só super_admin |

## Avisos
- O protótipo esconde botões na tela; isso **não é segurança**. O backend (RPCs `SECURITY DEFINER`
  + RLS RESTRICTIVE `can_see_school`) precisa recusar as mesmas ações mesmo se chamado direto.
- O risco da chave de cifragem no mesmo banco continua **em aberto**; este plano não o aceita.

## Etapas (cada uma exige confirmação explícita antes)
1. **Revisar a matriz real**: listar quem hoje tem `is_admin`, `admin_scope`, `user_permissions`
   e vínculos; Bruna confirma nome a nome antes de qualquer ampliação.
2. **Grupo operacional**: nova permissão própria do módulo (ex. `client_access_use_all` em
   `user_permissions`), que vale **somente** dentro de Acessos e senhas. Não altera `admin_scope`,
   não cria admin global, não muda Central/carteiras/Ponto.
   - Onboarding: conceder pela tela de usuários (ação registrada em `user_access_changes`).
   - Offboarding: revogar na saída/desligamento; revisão mensal da lista.
3. **Seleção de empresas** no módulo: lista = empresas visíveis por `can_see_school` com itens
   comuns; empresas restritas e inativas fora para não-super_admin.
4. **Backend em ambiente isolado** (PostgreSQL descartável, como `run.sh`): estender `tests2.sql`
   com a permissão nova — operacional usa comum de A e B; nega restrito, edição, auditoria,
   empresa restrita; revogação corta acesso imediatamente; nenhum ganho em outros módulos.
5. **Comparar com o schema real** só por leitura de estrutura (sem ler registros/segredos).
6. **Preservar dados antigos**: migração apenas aditiva; nada apagado; campos livres existentes
   revisados manualmente (podem conter credenciais críticas) antes de mudar regras.
7. **Rollback**: revogar a permissão nova (desliga o acesso amplo); versões anteriores das RPCs
   guardadas na migração para reverter; sem alteração destrutiva de colunas.
8. **Interface real**: portar o protótipo para `src/` só depois das etapas 1–5 aprovadas.

## Condições antes de importar credenciais
- Etapas 1–5 aprovadas e testadas; decisão registrada sobre o risco da chave.
- Credenciais críticas (senha de transação, frase de recuperação) fora do módulo.
- Itens bancários/sensíveis marcados como restritos na importação; dados fictícios em testes.

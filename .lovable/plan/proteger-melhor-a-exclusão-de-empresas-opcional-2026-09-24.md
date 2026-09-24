# Proteger melhor a exclusão de empresas (opcional)

Hoje a senha de confirmação para excluir empresas fica gravada no próprio app, e qualquer pessoa com conhecimento técnico consegue lê-la. Só a superadministradora vê o botão de excluir, mas a senha em si não protege nada.

## Proposta
- Trocar a senha fixa por uma confirmação mais segura: digitar o **nome exato da empresa** para confirmar a exclusão.
- Manter o botão visível só para a superadministradora.
- Conferir no servidor que apenas a superadministradora pode excluir empresas (não depender só da tela).

## Detalhes técnicos
- `src/components/SchoolSelector.tsx`: remover a comparação com a senha fixa; exigir `input === selectedSchool.name`.
- Verificar a política de exclusão na tabela `schools` e restringir a `is_super_admin()` via migration, se ainda não estiver.
- Nenhum dado financeiro ou cálculo é alterado.

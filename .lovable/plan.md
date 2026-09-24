# Corrigir exclusão de empresas e facilitar a configuração de etapas

## O que deu errado

**Exclusão de empresas**
- Nenhum pedido de exclusão chegou ao sistema nos últimos 60 minutos. A tela barrou a exclusão antes de enviar.
- A tela exige o nome **idêntico**, incluindo maiúsculas, acentos e espaços. Qualquer diferença mínima bloqueia a exclusão. Além disso, a janela fecha na hora do clique, então o aviso de erro passa quase despercebido.
- Há um segundo bloqueio, mesmo que o nome esteja certo: as proteções de "mês fechado" também impedem apagar lançamentos de meses fechados. Por isso, empresas com algum mês fechado nunca conseguiriam ser excluídas.

**Etapas**
- O botão **Configurar etapas**, dentro de cada empresa, só ajusta o modelo padrão, que ainda está vazio. Por isso aparece apenas o campo "etapa extra".
- As etapas que valem para todas as empresas são cadastradas no botão **Etapas padrão**, no topo da Central. Esse caminho não está claro na tela.

## O que vou fazer

1. **Exclusão**
   - Aceitar o nome da empresa sem diferenciar maiúsculas, espaços extras e acentos.
   - Manter a janela aberta até a exclusão terminar, mostrando o erro real se algo falhar.
   - Permitir a exclusão definitiva de uma empresa inteira, só pela superadministradora, mesmo com meses fechados. As proteções continuam valendo para todas as outras alterações e exclusões do dia a dia.
2. **Etapas**
   - Na janela "Configurar etapas" da empresa, quando o modelo padrão estiver vazio, mostrar um botão **Cadastrar etapas padrão**, que abre o editor do modelo direto dali.
   - Deixar claro na janela o que é "modelo padrão, que vale para todas" e o que é "etapa extra, só desta empresa".

## Detalhes técnicos
- `SchoolSelector.tsx`: normalizar com `normalize('NFD')`, remover acentos, `toLowerCase` e compactar espaços. Usar `onClick` com `preventDefault` no AlertDialogAction e só fechar após sucesso, exibindo `error.message` no toast.
- Nova RPC `delete_school(_school_id)` SECURITY DEFINER, restrita a `is_super_admin()`. Ela liga a variável de sessão `app.deleting_school = <id>` e exclui a escola. Migration atualiza as 8 funções `guard_*_closed_*` para retornar OLD em DELETE quando `current_setting('app.deleting_school', true) = OLD.school_id::text`. Também verificar `guard_bank_tx_immutable` com a mesma exceção. O hook `useDeleteSchool` passa a chamar essa RPC.
- `ClosingStepsDialog.tsx`: prop `onOpenTemplates`. O `ManagementCenter` fecha a janela da empresa e abre a de Etapas padrão.
- Nenhum cálculo financeiro é alterado.

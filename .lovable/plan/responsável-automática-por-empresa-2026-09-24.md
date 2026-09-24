# Responsável automática por empresa

## Objetivo
Preencher a coluna **Responsável** da Central de Clientes a partir das administradoras que já possuem aquela empresa liberada no login, mantendo uma responsável principal quando houver mais de uma pessoa com acesso.

## Regras da automação
- Considerar somente administradoras com carteira restrita e vínculo explícito com a empresa.
- Não considerar proprietária/superadministradora nem administradoras com acesso global, pois enxergar todas as empresas não significa ser responsável por todas.
- Se houver exatamente uma administradora vinculada, ela será definida automaticamente como responsável principal.
- Se houver mais de uma administradora vinculada, preservar a responsável principal já definida; se ainda não existir uma principal, mostrar **Definir responsável** sem escolher alguém aleatoriamente.
- Se a responsável perder o acesso à empresa:
  - atribuir automaticamente a única administradora restante;
  - se restarem várias, deixar pendente para escolha;
  - se não restar nenhuma, exibir **Não definida**.
- Alterações futuras nos acessos atualizarão essa regra automaticamente.

## Central de Clientes
- Exibir o nome da responsável principal, usando o e-mail apenas como apoio quando necessário.
- Na visão da proprietária, permitir escolher ou trocar a responsável principal entre as administradoras que já têm acesso à empresa.
- A busca e a visão **Por Responsável** continuarão usando essa responsável principal.
- A carteira simplificada de cada administradora continuará mostrando somente as empresas liberadas para ela.

## Dados e segurança
- Reaproveitar os vínculos de acesso existentes e o campo de responsável já criado; não duplicar cadastros.
- Criar uma automação no banco para sincronizar responsável e acesso com consistência.
- Fazer o preenchimento inicial apenas nos casos inequívocos, em que existe uma única administradora vinculada.
- Registrar a escolha principal na configuração gerencial da empresa e respeitar as permissões atuais.
- Não alterar PDFs, relatórios, importações, lançamentos, cálculos financeiros ou os motores oficiais.

## Validação
- Conferir empresas com zero, uma e várias administradoras vinculadas.
- Testar inclusão e remoção de acesso, troca manual da responsável principal e filtros da Central.
- Confirmar que clientes não visualizam a Central nem informações da carteira da Conta Muito.
- Validar que nenhuma informação financeira ou relatório foi modificado.

## Reversão
A automação e o seletor ficarão isolados na configuração da Central. Podem ser removidos sem alterar os vínculos de acesso existentes ou qualquer dado financeiro.

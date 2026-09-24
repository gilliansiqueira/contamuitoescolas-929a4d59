# Configuração das etapas de fechamento (Central de Clientes)

## Problema
Hoje não existe tela para cadastrar as etapas de fechamento. A Central mostra "Sem etapas cadastradas" porque a tabela `monthly_closing_checklist` está vazia para a empresa/mês.

## Decisões (confirmadas)
- Modelo padrão de etapas para todas as empresas, com ajustes por empresa (etapas a mais, a menos ou nomes diferentes).
- As etapas se repetem automaticamente todo mês, entrando como pendentes.

## O que será construído

### 1. Banco de dados (migration)
- Nova tabela `closing_step_templates`: etapas do modelo padrão (nome, ordem, ativa).
- Nova tabela `school_closing_step_overrides`: ajustes por empresa — desativar uma etapa do modelo, renomear ou adicionar etapa extra.
- Função `ensure_monthly_checklist(_school_id, _month)`: gera as etapas do mês para a empresa a partir do modelo + ajustes, de forma idempotente (não duplica, não apaga etapas já marcadas).
- Geração automática: ao abrir a Central ou a ficha da empresa em um mês sem etapas, o sistema chama a função e cria as etapas como pendentes.
- GRANTs + RLS: leitura para administradores; escrita restrita a administradores (super_admin para o modelo padrão).

### 2. Tela de configuração (somente equipe)
- Na Central de Clientes, botão "Configurar etapas" (engrenagem) por empresa e um atalho para o modelo padrão.
- Modelo padrão: lista ordenável de etapas (adicionar, renomear, desativar, reordenar).
- Por empresa: mostra as etapas do modelo com opção de desativar/renomear e campo para etapas extras daquela empresa.
- Mudanças valem a partir do próximo mês gerado; meses já gerados não são alterados retroativamente.

### 3. Execução mensal (visão da equipe)
- Na ficha da empresa (ou na Central), a equipe marca cada etapa como concluída/pendente/não se aplica, com registro de quem e quando (já existe em `monthly_closing_checklist` + `management_activity_history`).
- O percentual de fechamento e a situação na Central passam a refletir essas etapas automaticamente.

## Fora de escopo
- Nenhuma mudança em cálculos financeiros, Dashboard, Fluxo Diário ou Fluxo Bancário.
- Clientes não veem nem editam etapas.

## Validação
- Cadastrar modelo padrão, abrir a Central no mês atual e confirmar que as empresas saem de "Sem etapas cadastradas".
- Ajuste por empresa (desativar uma etapa + adicionar extra) reflete só naquela empresa.
- Virar o mês gera as etapas de novo como pendentes; marcar concluída atualiza o percentual.

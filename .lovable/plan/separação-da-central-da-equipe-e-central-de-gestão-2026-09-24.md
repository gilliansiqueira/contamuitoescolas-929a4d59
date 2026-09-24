# Separação da Central da Equipe e Central de Gestão

## Decisão de arquitetura
A referência enviada será usada como direção visual, não como imagem dentro do sistema.

Serão três experiências separadas:

1. **Seu acesso — Central de Gestão completa**
   - Tela inicial exclusiva para acompanhar a operação inteira, riscos, fechamento, relatórios e desempenho por responsável.
   - Menu próprio: Visão Geral, Fechamento Mensal, Por Responsável, Alertas e Pendências, Caixa Crítico.

2. **Acesso das meninas — Carteira de Clientes simplificada**
   - Será a tela inicial logo após o login, como na referência enviada; não ficará escondida dentro da aba Operação de uma empresa.
   - Mostra somente o necessário para trabalhar: empresas atribuídas, situação, responsável, conciliação, pendências e botão Acessar.
   - Ao clicar em Acessar, abre a empresa na moldura já aprovada; Operação continua reunindo as ferramentas administrativas daquela empresa.
   - Sem visão estratégica da carteira completa, riscos financeiros globais ou informações de outras responsáveis, salvo autorização específica.

3. **Acesso dos clientes — experiência atual preservada**
   - Uma empresa: Dashboard direto.
   - Mais de uma empresa: seleção simples das empresas autorizadas.
   - Nenhuma Central, responsável interna, carteira ou empresa alheia fica visível.

## Confirmação do acesso proprietário
A consulta confirmou um único usuário correspondente:
- E-mail: `adm@contamuito`
- ID: `998b855d-02a3-44e7-b289-30cc8cb9bc8d`
- Perfil atual: função `admin`, acesso global (`admin_scope = all`), sem empresa principal vinculada.

Antes de qualquer mudança em permissões, esse usuário será confirmado como o seu acesso. Não será criada condição por e-mail no código.

## Modelo seguro de permissões
- Ampliar a função existente para admitir `super_admin`, mantendo funções na tabela separada `user_roles`.
- Atribuir `super_admin` somente ao usuário confirmado acima.
- `super_admin`: Central de Gestão e carteira inteira.
- `admin`: Carteira simplificada, limitada às empresas permitidas ou atribuídas.
- `cliente`: somente suas empresas e páginas atuais.
- Proteger interface, entrada da página, consultas e políticas do banco; digitar o endereço não contorna a proteção.
- Remover a verificação atual por e-mail usada para exclusão e substituir por autorização real. Excluir empresa permanece fora das telas principais e exige confirmação.

## Fontes confiáveis já existentes
- Empresas e vínculos de acesso: `schools`, `profiles`, `user_schools`, `user_roles`.
- Última importação e data coberta: `upload_records`, `bank_statement_imports`, lançamentos bancários/financeiros.
- Conciliação: `bank_transactions.recon_status`.
- Fechamento do período: `period_closures` e snapshots.
- Auditoria bancária: `bank_reconciliation_history`.
- Fluxo e saldos: motores financeiros atuais, sem recálculo paralelo.

## Novas informações necessárias
- Responsável interna por empresa.
- Checklist mensal e quais etapas se aplicam a cada empresa.
- Situação manual: aguardando cliente, revisão concluída, relatório entregue, canal e data de entrega, próxima ação e observações.
- Histórico imutável das alterações do fechamento.
- Prazo configurável por empresa.
- Posteriormente, critérios aprovados para caixa crítico e alertas.

## Percentuais
- **Conciliação:** `conciliadas ÷ (total − não se aplica) × 100`, no período. Sem fonte bancária: “Sem conciliação”.
- **Dados concluídos:** etapas de dados concluídas ÷ etapas de dados aplicáveis.
- **Relatórios entregues:** empresas com entrega registrada ÷ empresas aplicáveis.
- **Fechamento finalizado:** empresas com todas as etapas aplicáveis concluídas ÷ empresas aplicáveis.
- Os três indicadores da Central de Gestão permanecerão separados.

## Checklist mensal proposto
Automático apenas quando houver fonte confiável:
- Extratos atualizados.
- Conciliação concluída.
- Despesas importadas.
- Receitas atualizadas.
- Período fechado.
- Relatório gerado, se existir registro técnico confiável.

Manual com autoria, data e histórico:
- Aguardando informação do cliente.
- Revisão concluída.
- Relatório entregue e canal.
- Próxima ação e observação interna.

Etapas podem ser “não se aplica” e ficam fora do denominador.

## Situação e alertas — proposta para aprovação posterior
- **Finalizado:** todas as etapas aplicáveis concluídas e entrega registrada quando aplicável.
- **Bloqueado:** marcado como aguardando informação do cliente.
- **Atrasado:** ultrapassou o prazo configurado da empresa com etapa obrigatória aberta.
- **Atenção:** pendências abertas ainda dentro do prazo.
- **Em dia:** nenhuma pendência vencida e dados dentro do prazo.
- Caixa crítico só será criado após aprovar uma fórmula baseada no saldo oficial e nas projeções da SSOT; nunca por valor ilustrativo.

## Telas e identidade
- **Equipe:** seguir a referência enviada — navegação compacta, quatro resumos essenciais e lista simples, mantendo a identidade laranja aprovada em vez do menu azul-escuro da imagem.
- **Você:** Central de Gestão mais completa, com as cinco áreas solicitadas, nos modos claro e noturno.
- **Cliente:** menu e conteúdo atuais preservados nos modos claro e noturno.

## Implementação em fases
### Fase 1
1. Confirmar o usuário proprietário e criar `super_admin` com proteção integral.
2. Criar responsável, checklist mensal, entrega de relatório, prazo por empresa e histórico.
3. Criar a Carteira simplificada da equipe.
4. Criar a Central de Gestão exclusiva com Visão Geral, Fechamento e Por Responsável.
5. Manter a seleção atual disponível para reversão até a validação.

### Fase 2
Automatizar somente estados comprováveis, alertas de atraso, fila de prioridades e avisos internos.

### Fase 3
Definir e implementar caixa crítico, abertura mensal automática, notificações e resumos.

## Garantias e reversão
- Nenhum PDF, relatório, gráfico, valor, cálculo financeiro ou motor SSOT será alterado.
- Entrar em uma empresa continua abrindo os mesmos componentes atuais; portanto, a geração de PDF não é afetada.
- As novas telas consultam dados, sem mudar a lógica financeira.
- Cliente nunca recebe consultas globais.
- Reversão: restaurar a seleção atual como entrada; estruturas novas são isoladas e não substituem dados existentes.
- Testes separados: seu usuário, admin da equipe, cliente com uma empresa, cliente multiempresa, modos claro/noturno e tentativa de acesso direto sem permissão.

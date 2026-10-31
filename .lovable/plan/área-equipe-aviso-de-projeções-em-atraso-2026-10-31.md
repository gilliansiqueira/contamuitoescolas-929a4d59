# Área "Equipe" + aviso de projeções em atraso

## Parte 1 (primeiro, urgente): aviso de projeções em atraso
O aviso sumiu porque o prazo das projeções (30/10) já passou e o aviso só mostrava prazos que ainda iam vencer.

Nova regra, pela carteira de cada pessoa da equipe ao entrar na plataforma:
- Uma projeção só conta como **entregue** quando as 3 etapas estão concluídas: Atualizar receitas e despesas futuras, Comparar projetado x realizado e Enviar simulação.
- A etapa "futuras" só vale se tiver sido marcada no máximo 15 dias antes do prazo. Se foi marcada antes disso, a projeção volta a contar como **não entregue**.
- Faixa e janela em vermelho: "**3 projeções em atraso**. Faltam X dias para a entrega do relatório e texto (06/11)", com a lista das empresas e um atalho para cada uma.
- As gestoras e você veem o total da equipe, separado por carteira.
- Some quando todas estiverem entregues. Os prazos continuam editáveis onde já estão hoje.

## Parte 2: menu "Equipe" com subáreas
O item "Ponto da equipe" vira **Equipe**, com estas abas:

1. **Ponto**: as telas atuais (mês, justificativas, logins, planilha da contabilidade).
2. **Benefícios (VR e VT)** por mês:
   - Os dias úteis do mês vêm preenchidos automaticamente (seg–sex, sem feriados) e você pode editar.
   - Faltas e atestados de cada pessoa vêm do Ponto. Desligadas contam só até a data de saída.
   - VR = valor diário × (dias úteis − faltas/atestados), mantendo os descontos fixos já cadastrados.
   - VT = R$ 12,00 × (dias úteis − faltas). Cada falta desconta R$ 12. O valor diário fica editável.
   - Por pessoa você marca se ela recebe o "VT no cartão".
3. **Holerites e PIX**:
   - Você sobe um único PDF com todos os holerites. O sistema separa por pessoa e lê o líquido de cada uma.
   - A leitura é conferida pela soma: se não bater, o PDF não é usado.
   - PIX = líquido + VR + VT. Para quem recebe VT no cartão, o PIX é só líquido + VR.
   - Mostra o total geral, a tabela por pessoa e um botão para copiar ou baixar. O PDF fica guardado com o mês e pode ser excluído (os valores lidos saem junto).
4. **Usuários e carteiras**: lista de todos os usuários da equipe e dos clientes, com as empresas de cada um. Por aqui você pode alterar acessos, papéis e permissões e transferir carteiras, sem entrar empresa por empresa. As regras de quem pode alterar o quê continuam as mesmas: Isabelly e Gisele gerenciam colaboradores, e só você mexe em papéis.
5. **Meu Dia, pedidos e avisos**: as tarefas fixas por empresa (como os saldos de Cuiabá) e os pedidos de clientes ficam reunidos aqui. Você cria, edita e reatribui por aqui, junto com os avisos de prazo.

Tudo continua visível só para a equipe autorizada e separado das finanças das escolas.

## Ordem de entrega
Parte 1, depois Benefícios, Holerites e PIX, Usuários e carteiras e, por fim, Meu Dia, pedidos e avisos.

## Detalhes técnicos
- Atraso: regra pura em `src/lib/teamDeadlines.ts` (com teste) sobre `monthly_closing_checklist` (proj_futuras, proj_realizado, proj_simulacao), usando o timestamp de conclusão da etapa ≤ 15 dias antes do prazo de projeções do aviso ativo; escopo pela carteira via RPCs do portfólio; exibido em `TeamDeadlineNotice.tsx`.
- Novas tabelas `team_benefit_month` (dias úteis, VT diário, overrides) e coluna `vt_cartao` em `team_payroll_defaults`; `team_payslip_uploads` com bucket privado e linhas lidas por pessoa. GRANT + RLS: leitura `can_view_team_time()`, escrita `is_super_admin()`.
- Regras puras em `src/lib/teamTime/benefits.ts` e `payslip.ts` (parser do PDF no navegador, conferência pelo total), com testes.
- Usuários e carteiras reutilizam as funções de servidor e RPCs que já existem (`set_collaborator_scope`, `transfer_portfolio`, `set_management_responsible`), sem criar caminhos novos de escrita.
- Rota com abas em `TeamTimePanel`, que vira o contêiner "Equipe".
- Para ler o PDF de holerites, preciso de um exemplo real: vou pedir quando chegar nessa etapa.

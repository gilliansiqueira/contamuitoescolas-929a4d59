# Central de Clientes — Relatórios de setembro

## O que encontrei
- **Cards do topo** (Projeção 59, os outros 0): cada empresa conta só na **primeira** etapa aberta. Como "Projeção" vem primeiro e quase todas têm algo aberto ali, as 59 ficam nesse card e os outros mostram 0. Por isso a tela parece não mudar, mesmo com Dourados já marcada em Contas pagas, como aparece no seu print.
- **Comparar projetado x realizado**: hoje só marca com a conciliação do mês em 100%. Não considera que, nas empresas com Fluxo Bancário ativado, o realizado já entra todo dia sozinho.
- **Conciliação de despesas (Dourados)**: falta 1 lançamento de setembro. É um Pix recebido de LAURECI S F, R$ 85,00, de 30/09, no Banco do Brasil. Ele entrou ontem às 16:13, na importação do extrato, e continua pendente, sem motivo. Por isso não chega a 100%.

## O que vou mudar
1. **Cards**: cada card vai contar todas as empresas que ainda têm aquela etapa aberta, e não só a primeira. Exemplo: "Análise de despesas: 40 aguardando". Ao clicar, a lista mostra só essas empresas.
2. **Comparar projetado x realizado**: vai marcar sozinho quando a empresa usa o Fluxo Bancário (botão ativado) e o mês já terminou. O texto será "Realizado atualizado diariamente pelo Fluxo Bancário". Nas empresas sem o botão, continua a regra da conciliação em 100%.
3. **Conciliação de despesas**: continua exigindo 100%. Se faltar pouco, a etapa vai mostrar quantos lançamentos e o valor. Exemplo: "Falta 1 lançamento (R$ 85,00)". Assim a equipe vê o que falta sem procurar.
4. Vou recalcular setembro em todas as empresas ativas e conferir Dourados na tela com o seu login.

Para Dourados fechar a conciliação, basta conciliar o Pix de R$ 85,00.

## Detalhes técnicos
- `ManagementCenter.tsx`: o `match` dos cards de etapa passa a testar "grupo com alguma etapa aberta" em vez de "primeiro grupo aberto". O filtro da lista usa a mesma regra.
- `_refresh_report_progress`: `proj_realizado` = `v_recon OR (school_data_sources.dashboard_source='fluxo_caixa' AND v_end <= hoje)`, com motivo próprio. `desp_conciliacao` grava a nota "Falta N lançamento(s) (R$ X)" quando está aberta e a etapa é automática.
- Backfill de `_refresh_report_progress(id,'2026-09')` nas empresas ativas.

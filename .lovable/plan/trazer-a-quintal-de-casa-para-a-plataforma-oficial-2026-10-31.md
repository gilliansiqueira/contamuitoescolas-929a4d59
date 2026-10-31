# Trazer a Quintal de Casa para a plataforma oficial

O projeto da Quintal é uma cópia antiga desta plataforma, com banco de dados próprio e cerca de 30 telas e cálculos exclusivos. A empresa "Quintal de Casa" já existe aqui, mas sem nenhum lançamento. O objetivo é que, ao abrir a Quintal aqui, tudo fique exatamente como está no projeto dela, sem afetar as outras empresas.

## O que vem para cá (só na Quintal, por chave de recurso)
- **CNPJs da empresa:** seletor de CNPJ, rateio de lançamentos sem CNPJ e comparativo por CNPJ.
- **Centros de custo com passeios:** ticket médio por centro, importação de passeios, busca de despesas com fornecedor e descrição original.
- **Indicadores:** os 8 cartões de gestão, resultado anual, margem sem sócios, recebimentos por forma e a escolha entre competência e caixa.
- **Simulação:** "Previsão do futuro" com expedições (ticket e custo históricos, distribuição mensal), no lugar do quadro antigo.
- **Painel:** saldos por banco e aviso de revisão financeira.
- **Sem Renovação escolar** e sem as abas que só fazem sentido para escola.
- **Central:** a Quintal entra na carteira e no controle de andamento (tarefas do dia, relatório mensal, conciliação).
- **Fluxo Bancário** liberado a partir de **novembro/2026**, usando o saldo informado dos bancos em 31/10.

## Dados (nada se perde)
1. Peço a você a exportação das tabelas do projeto da Quintal em arquivos CSV, uma por vez e com o passo a passo de onde clicar.
2. Antes de gravar, confiro cada arquivo: quantidade de linhas e totais por mês, comparados com o que aparece na tela do projeto da Quintal.
3. Gravo tudo na empresa "Quintal de Casa" daqui, mantendo origem e rastreabilidade dos uploads.
4. Comparo tela com tela (painel, realizado, indicadores, simulação) nos meses de 2025 e 2026. Qualquer diferença é explicada linha a linha antes de concluir.
5. O projeto da Quintal continua intacto até você confirmar que está tudo igual aqui.

## Ordem de entrega
1. Estrutura nova no banco e telas exclusivas (sem dados ainda), com testes dos cálculos copiados.
2. Importação dos dados exportados e conferência.
3. Liberação do Fluxo Bancário (nov/2026) e entrada na Central.
4. Conferência final lado a lado com você.

## Detalhes técnicos
- Copiar os arquivos novos do snapshot (`CnpjConfig`, `EntitySelector`, `GestaoIndicadores`, `PrevisaoFuturo`, `TicketCentroCusto`, `BuscaDespesas`, `SaldosBancosCard`, `lib/previsao.ts`, `gestaoIndicadores.ts`, `descricaoParser.ts`, `saldoBancos.ts` e hooks) com os testes deles.
- Nos 55 arquivos que existem nos dois projetos e mudaram, aplicar só as diferenças específicas da Quintal, atrás de `school_features` (ex.: `quintal_mode`), sem regredir as correções já feitas aqui. A SSOT continua única: os cálculos da Quintal entram como funções puras que leem os mesmos dados.
- Novas tabelas: `company_entities`, `entity_allocation_rates`, `expense_detail_trips`, `financial_month_statuses`, `simulation_assumptions`, `bank_balances` e `entity_monthly_totals` (conforme o esquema do snapshot). Todas com `school_id`, GRANT, RLS e a política RESTRICTIVE `can_see_school`.
- Na importação, o `school_id` da Quintal antiga é trocado pelo id daqui (`9e826bce…`). Os UUIDs são preservados para manter as relações, e os usuários são trocados pelos equivalentes daqui (ou ficam nulos).
- Renovação escolar desligada na Quintal via `school_features`/`module_tabs`.

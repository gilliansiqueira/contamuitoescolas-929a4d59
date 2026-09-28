# Controle diário da conciliação na Central de Clientes

## Como funciona hoje (conferido)
- A porcentagem de conciliação é **do mês inteiro** (todos os lançamentos bancários do mês), então quase não se mexe no dia a dia.
- A aba **Pendências** só filtra a mesma tabela da Carteira: os cards do topo e as colunas continuam iguais, por isso parece que "não muda nada". E não mostra **quais** são as pendências nem de que dia.

## Ideia: seletor "Hoje | Dia anterior | Mês" no topo
Um seletor com três visões, que troca os cards, a coluna de andamento e os anéis por responsável:

```text
[ Hoje (ao vivo) ]  [ Dia anterior ]  [ Mês ]
```

### 1. Hoje (ao vivo) — cobrar dentro do próprio dia
Para cada empresa e cada menina, mostra o que já aconteceu hoje:
- **Extrato de ontem subido?** (sim / não)
- **Conciliação de hoje**: quantos lançamentos ela já conciliou hoje e o % do extrato do dia.
- **Última atividade na plataforma** (ex.: "há 12 min", "sem atividade hoje").
- Selo **"Atrasada"** quando passar de um horário limite (sugestão: 12h sem extrato subido, ou 15h com conciliação abaixo de 100%). Os horários ficam ajustáveis.
- Cards do topo: "Extratos não enviados", "Conciliação em andamento", "Concluídas hoje", "Sem atividade hoje".
- Em "Por responsável": um cartão por menina com o andamento de hoje e há quanto tempo ela não usa a plataforma.

### 2. Dia anterior — fechamento de ontem
- % conciliado do extrato do último dia útil (na segunda, sexta). Recomeça todo dia.
- Mostra quem fechou 100% e quem deixou pendência — base para cobrar de manhã.

### 3. Mês — visão que existe hoje
- Continua como está (% do mês e fechamento), nada some.

## Aba Pendências nova (lista própria, não filtro)
- Cards do topo passam a ser de pendências: **total pendente**, **empresas com pendência**, **pendência mais antiga (dias)**, **valor pendente**.
- Lista agrupada **Responsável → Empresa → Dia**, acumulando dias anteriores (a partir de 01/09/2026). Ex.: Thau — Boa Vista: sexta 5 + quinta 2 = **7**.
- Clicar numa empresa **abre as pendências dela na hora**: cada lançamento com data, descrição, valor, conta e há quantos dias está pendente.
- Botão "Ir conciliar" leva direto ao Fluxo Bancário daquela empresa.
- Filtros por responsável e por idade (1 dia, 2–3 dias, mais de 3 dias).
- Conciliou → some da lista automaticamente.
- O card "Prioridades de hoje" da Carteira passa a ser clicável e abre essas mesmas pendências.

## O que NÃO muda
- Nenhum lançamento, saldo, Dashboard, Fluxo Diário ou relatório de cliente é alterado — tudo só leitura.
- Clientes continuam sem acesso a essa área.

## Detalhes técnicos
- Migration apenas aditiva (só funções `SECURITY DEFINER` + `GRANT EXECUTE` a authenticated), com a mesma checagem `is_admin()` e escopo por responsável de `get_management_portfolio` (que fica intacta):
  - `get_management_reconciliation_day(_day date)` → por empresa: dia de referência (último dia útil antes de `_day`), exigidos (`recon_status <> 'nao_aplica'`, `is_forecast = false`), conciliados, pendentes, extrato recebido (existe `bank_statement_imports` com `periodo_fim >= referência`).
  - `get_management_today_activity()` → por empresa/responsável: conciliados hoje (`bank_reconciliation_history.changed_at` hoje em America/Sao_Paulo), importações hoje (`bank_statement_imports.created_at`), última atividade (maior entre histórico de conciliação, importações e `audit_log`).
  - `get_management_reconciliation_backlog()` → pendências `recon_status = 'pendente'`, `is_forecast = false`, `data >= '2026-09-01'` e `< hoje`, com id, empresa, responsável, data, descrição, valor, conta.
- Horários limite do selo "Atrasada" como constantes no frontend nesta fase.
- Frontend: hooks novos em `useManagementPortfolio.ts`; `ManagementCenter.tsx` ganha o seletor de visão, cards por visão, view `pending` própria com painel de detalhes, e navegação para o Fluxo Bancário da empresa.
- Validação: conferir por consulta direta 2–3 empresas (ex.: Jurassic, Boa Vista) contra a tela, e testar a tela logado como adm@contamuito.

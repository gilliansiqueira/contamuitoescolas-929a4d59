# Conciliação diária na Central de Clientes

## Como funciona hoje (conferido)
- A porcentagem de conciliação é **do mês inteiro**: pega todos os lançamentos bancários do mês escolhido e mostra quantos estão conciliados. Por isso ela quase não se mexe no dia a dia.
- As pendências também são do mês inteiro, misturando conciliação com as etapas de fechamento, e sem mostrar **de que dia** é cada pendência.

## O que muda

### 1. Porcentagem que renova todo dia
- Cada empresa passa a mostrar a **Conciliação do dia**: dos lançamentos do extrato do último dia útil (ex.: na segunda, os de sexta), quantos já foram conciliados.
- Todo dia a conta recomeça. Se o extrato do dia ainda não foi subido, aparece "Extrato não enviado" (em vez de 0% ou 100%).
- O card "Conciliação pendente" do topo passa a contar as empresas com o dia **não concluído**.
- Em "Por responsável", o anel de conciliação de cada menina passa a ser o do dia.
- A porcentagem do mês continua existindo no fechamento — não some nada.

### 2. Aba Pendências acumulando por dia
- Mostra **só pendências de conciliação** (lançamentos ainda não conciliados), de dias anteriores a hoje, a partir de 01/09/2026.
- Agrupada por **responsável → empresa → dia**. Exemplo: Thau — Boa Vista: sexta 5, quinta 2 = **7 pendências**.
- Cada grupo mostra há quantos dias está pendente (a mais antiga em destaque) e o botão para abrir a empresa e resolver.
- Filtro por responsável, para cobrar cada uma no dia seguinte.
- Assim que um lançamento é conciliado, ele sai da lista automaticamente.

### O que NÃO muda
- Nenhum lançamento, saldo, Dashboard, Fluxo Diário ou relatório de cliente é alterado. É só leitura.
- Clientes continuam sem acesso a essa área.

## Detalhes técnicos
- Nova função de leitura (security definer, mesma checagem `is_admin()` e mesmo escopo por responsável da `get_management_portfolio`): `get_management_daily_reconciliation(_day date)` → por empresa: dia de referência (último dia útil antes de `_day`, pulando sábado/domingo), total exigido (`recon_status <> 'nao_aplica'`, `is_forecast = false`), conciliados, pendentes, flag "sem extrato".
- Nova função `get_management_reconciliation_backlog()` → linhas (school_id, responsável, data, qtde pendente, valor) de `bank_transactions` com `recon_status = 'pendente'`, `is_forecast = false`, `data >= '2026-09-01'` e `data < hoje (America/Sao_Paulo)`.
- Migration apenas aditiva (só cria funções + GRANT EXECUTE para authenticated); `get_management_portfolio` fica intacta.
- Frontend: novos hooks em `useManagementPortfolio.ts`; `ManagementCenter.tsx` usa o % do dia na carteira/cards/responsáveis e troca a view `pending` pela lista acumulada agrupada.
- Validação: conferir com consulta direta os números de 2–3 empresas (ex.: Jurassic, Boa Vista) contra a tela.

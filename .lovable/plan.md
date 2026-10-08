# Lançamentos manuais: somar no resultado sem mexer no saldo, e lugar para conferir/editar/excluir

## O que acontece hoje
- O lançamento manual (Upload de Dados → adicionar manualmente) segue a regra da categoria escolhida. Receita e Despesa entram no Resultado **e** no Caixa, por isso o saldo de Sinop e Portão mudou.
- Ao salvar, o valor também é somado no Histórico Financeiro do mês. Não há uma lista clara dos lançamentos manuais para conferir, corrigir ou excluir.

## O que muda (para a equipe)
1. **Nova opção no lançamento manual: "Não altera o saldo bancário"** (vem marcada por padrão em empresas com Fluxo Bancário ativo).
   - Marcada: o valor entra em Receita/Despesa e no Resultado, mas não muda o Saldo, o Caixa nem o Fluxo Diário.
   - Desmarcada: funciona como hoje.
2. **Novo quadro "Lançamentos manuais" no Dashboard**, logo abaixo dos cartões do mês selecionado:
   - Mostra data, descrição, categoria, valor, se altera ou não o saldo, quem lançou e quando.
   - Botões **Editar** (data, descrição, valor, categoria, opção do saldo) e **Excluir** (com confirmação).
   - Total do mês por Receita / Despesa / Operação, para conferir rápido.
3. A mesma lista e os mesmos botões aparecem em Upload de Dados, para quem lançar por lá.
4. **Sinop e Portão**: marcar os lançamentos de setembro já feitos como "Não altera o saldo bancário", devolvendo o saldo ao valor do extrato. Mostro o antes e depois de Resultado e Saldo de setembro.

## Cuidados
- Editar ou excluir atualiza também o valor do Histórico Financeiro do mês, sem deixar sobra.
- Mês fechado continua bloqueado para edição/exclusão (mesma regra de hoje).
- Nenhum cálculo novo fora do motor oficial: a regra fica no motor de lançamentos.

## Detalhes técnicos
- Migração: `financial_entries.afeta_saldo boolean not null default true` (RLS já existente cobre).
- `FinancialEntry.afetaSaldo` em `src/types/financial.ts`; mapear em `useFinancialData`.
- `ledgerEngine`: quando `afetaSaldo === false`, força `impactaCaixa=false` mantendo `entraNoResultado` da regra. Verificar que o Caixa/Fluxo Diário/`bankCashflowOverlay` e `periodMovement` consomem o mesmo resultado (sem caminho paralelo). Teste em `src/test/ledgerEngine.test.ts`.
- `FileUpload.tsx` `handleManualSave`: checkbox nova; espelho em `historical_monthly` mantido.
- Novo componente `ManualEntriesPanel` (Dashboard + Upload de Dados), filtra `origem='manual'` no mês; editar/excluir ajustam `historical_monthly` pela diferença (subtrai valor antigo, soma o novo).
- Atualização dos 2 lançamentos de Sinop e 6 de Portão para `afeta_saldo=false`.
- Registrar regra em `AGENTS.md`.

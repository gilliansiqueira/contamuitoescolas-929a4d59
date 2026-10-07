# Sinop: lançamentos manuais de conta fora do Fluxo Bancário

## O que acontece hoje
Os dois lançamentos estão gravados em Sinop (30/09/2026, manuais):
- Receitas setembro Sicredi — entrada R$ 37.168,82
- DL — saída R$ 30.000,00

Sinop usa o Fluxo Bancário como fonte do realizado. A partir da data de início dele, o sistema descarta **todo** realizado que não vem do extrato, inclusive lançamentos manuais. Por isso eles não aparecem no Dashboard.

## O que muda
- Lançamentos **manuais** (feitos em "Upload de dados" → adicionar manualmente) passam a somar ao realizado mesmo em empresas com Fluxo Bancário ativo. Servem para contas que não estão cadastradas no Fluxo Bancário.
- A planilha de Fluxo de Caixa Realizado antiga continua sendo substituída pelo extrato (sem duplicar).
- Em Sinop, setembro passa a mostrar Receita +R$ 37.168,82 e Despesa +R$ 30.000,00 (Resultado +R$ 7.168,82), seguindo a classificação de cada tipo.

## Cuidado antes de ativar
Antes da mudança, listar outras empresas com Fluxo Bancário ativo que tenham lançamentos manuais realizados depois do início — esses valores também passariam a aparecer. Se houver algum que já esteja no extrato (duplicaria), aviso antes de seguir.

## Detalhes técnicos
- `src/lib/bankCashflowOverlay.ts` → `applyCashflowOverlay`: o filtro `kept` deixa de remover entradas com `origem === 'manual'`; continua removendo realizado de `origem 'fluxo'` e demais após `startDate`.
- Teste em `src/lib/__tests__/` cobrindo: manual mantido, fluxo removido.
- Consulta prévia em `financial_entries` (origem manual, realizado, data >= início) nas empresas com `school_data_sources.status='ativo'`.
- Registrar a regra em `AGENTS.md`.

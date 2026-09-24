# Ativar o Fluxo de Caixa no Dashboard e no Fluxo Diário — Uberlândia Santa Mônica

## Situação atual (conferida agora)
- Santa Mônica: 341 lançamentos gerados, **0 a classificar**, **0 transferências sem par**, sincronizado até 24/09 às 15:49.
- Status: **Em conferência**. O Dashboard e o Fluxo Diário ainda leem só a planilha — a leitura do Fluxo de Caixa ainda não foi ligada neles (etapa reservada para depois da aprovação).

## O que falta (nesta ordem)

1. **Ligar a leitura nas telas (sem ativar ainda)**
   - Dashboard e Fluxo Diário passam a saber usar os lançamentos do Fluxo de Caixa, mas só quando a empresa estiver **Ativa**.
   - A partir de 01/09/2026: realizado vem do extrato; a planilha antiga desse período é deixada de lado no cálculo (não é apagada).
   - Junho a agosto continuam vindo exatamente como hoje.
   - Projeções (Sponte, cartões, contas a pagar) continuam aparecendo só como projetado, depois de "atualizado até", sem somar com o realizado.
   - Saldo inicial de setembro = saldo de 31/08 das contas (conta + aplicado); saldo de cada dia = final do dia anterior.
   - Linha "Movimentações em classificação" só aparece se houver valor (hoje zero em Santa Mônica).
   - Selo "Atualizado automaticamente até DD/MM".

2. **Prévia antes de ativar**
   - Na Conferência Dashboard, mostrar lado a lado: totais do Fluxo de Caixa × como o Dashboard ficaria × como o Fluxo Diário ficaria (entradas, saídas, resultado, operações, saldo final). Os três precisam fechar.

3. **Botão "Aprovar e ativar"** (só administradores)
   - Muda o status de Santa Mônica para **Ativo**, registrando quem e quando.
   - Botão **"Pausar / voltar para a planilha"** sempre disponível — volta na hora, sem perda de nada.

4. **Validação**
   - Conferir Santa Mônica ativa no Dashboard e Fluxo Diário; trocar para Centro, Dourados e outra empresa e confirmar que nada mudou nelas.
   - Confirmar que Análise de Despesas segue igual.

## O que vocês fazem
Depois da etapa 2, abrir a prévia, conferir os números e clicar em **Aprovar e ativar**. Centro e Dourados seguem o mesmo caminho quando terminarem as divergências.

## Detalhes técnicos
- `useFinancialData.ts` (fonte SSOT das telas) passa a ler `school_data_sources`; se `status='ativo'` e fonte `fluxo_caixa`, entradas com data ≥ `start_month` vêm de `bank_cashflow_entries` mapeadas para o formato de `financial_entries` (tipo = `tipo_nome` do item do modelo), e as `financial_entries` realizadas desse período são filtradas do cálculo. Os motores `projectionEngine`/`ledgerEngine` não são duplicados — recebem o mesmo formato.
- Projeções filtradas para datas > `synced_through`.
- Saldo inicial derivado de `bank_account_balances`/`bank_accounts` na data 31/08.
- Ativação/pausa via update em `school_data_sources.status` com registro em `audit_log`; RLS atual já restringe a administradores.
- Nenhuma escrita em `financial_entries` nem em datas anteriores a 01/09/2026.

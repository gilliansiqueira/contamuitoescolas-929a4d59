# Fluxo Bancário ligado automaticamente em empresas novas

## Situação conferida
- Só três empresas estão sem o Fluxo Bancário: **Central Press** (cadastrada hoje), Demo e "teste 4" (essas duas ficaram de fora de propósito).
- Hoje não existe nada que ligue o Fluxo Bancário quando uma empresa nova é cadastrada. Por isso a Central Press veio sem ele.

## O que vou fazer
1. **Empresas novas:** ao cadastrar uma empresa, o sistema já liga o Fluxo Bancário e cria a configuração **Em conferência**, igual às outras empresas. O Dashboard e o Fluxo Diário continuam usando a planilha até vocês aprovarem na Conferência Dashboard.
2. **Central Press:** ligar agora, com a mesma configuração.
3. Demo e "teste 4" continuam de fora.

## Regras preservadas
- Nenhum lançamento é criado ou alterado. Só a aba passa a aparecer.
- Tudo reversível por empresa.

## Detalhes técnicos
- Migration: trigger `AFTER INSERT ON schools` (security definer) que insere `school_features(cashflow_bank_pilot, enabled=true)` e `school_data_sources(status='em_conferencia', start_month='2026-09', mesmas fontes padrão das demais)` com `ON CONFLICT DO NOTHING`; ignora a escola Demo.
- Na mesma migration, preencher a Central Press (cc184cd3-...) pelos mesmos valores.
- Conferir no banco depois que as linhas existem.

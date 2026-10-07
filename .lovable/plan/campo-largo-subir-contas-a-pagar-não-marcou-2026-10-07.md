# Campo Largo — "Subir Contas a Pagar" não marcou

## O que encontrei
- A Thau subiu sim as despesas de setembro: 85 lançamentos, hoje (07/10) às 08:58.
- O prazo do relatório de setembro era ontem, 06/10 (5º dia útil).
- Hoje a regra só marca sozinha quando as despesas entram **até o prazo**. Como entraram um dia depois, o sistema não marcou. Não é falha no envio.

## O que vou mudar
1. A etapa "Subir Contas a Pagar" passa a marcar sozinha sempre que existirem despesas do mês, mesmo depois do prazo.
2. Quando entrar depois do prazo, a nota fica "Marcado automaticamente: despesas lançadas com atraso em 07/10". Assim o atraso continua visível.
3. A mesma regra vale para todas as empresas. Vou recalcular setembro nas empresas ativas e conferir Campo Largo na tela.
4. Nada marcado à mão pela equipe é desfeito.

## Efeito nos números
Nenhum. Só muda o andamento do relatório na Central.

## Técnico
- `_refresh_report_progress`: em `v_pagas`, remover o filtro `created_at < v_due` de `realized_entries` (e equivalente em `upload_records`); se o primeiro lançamento for após `v_due`, gravar nota com "com atraso em DD/MM".
- Backfill: `_refresh_report_progress(id, '2026-09')` nas empresas ativas.

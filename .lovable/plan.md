# Análise de despesas: contar só saídas na conciliação

## O que foi encontrado (Rio Verde, setembro)
- Despesas lançadas: 187 (R$ 177.392,01). "Contas pagas" já está concluída.
- A etapa "Conciliação de despesas" conta hoje **todos** os lançamentos pendentes do banco: 12 (R$ 16.953,30).
- Desses 12, **11 são entradas** (R$ 7.133,89) — a Bruna está certa, não são despesas.
- **1 é saída**: 22/09, "DÉB.CONV.DEMAIS EMPRESAS", R$ 9.819,41 (já tem motivo, mas segue pendente).

## O que muda
1. A etapa "Conciliação de despesas" passa a olhar **só saídas**. A nota vira "Falta N saída(s) (R$ X)".
2. A etapa "Comparar projetado x realizado" continua olhando entradas e saídas (não muda).
3. Recalcular setembro em todas as empresas ativas; etapas marcadas à mão pela equipe não são mexidas.

## Resultado esperado em Rio Verde
- A etapa mostra "Falta 1 saída (R$ 9.819,41)". O card fica concluído assim que esse débito de 22/09 for conciliado.

## Detalhes técnicos
- Migração recria `_refresh_report_progress`: novo `v_desp_pend_n/v` com filtro `tipo='saida'`, usado em `desp_conciliacao`; `v_recon`/`v_recon_note` atuais continuam em `proj_realizado`.
- Backfill: chamar `_refresh_report_progress(school, '2026-09')` nas empresas ativas.

# Piraquara — receitas e despesas infladas em outubro

## O que encontrei
Não há extrato duplicado. O salto vem de 4 lançamentos do Sicoob em outubro que estão classificados errado: dinheiro que só muda de lugar e entrou como Receita ou como Despesa.

| Data | Lançamento | Valor | Hoje está como | Deveria ser |
|---|---|---|---|---|
| 13/10 | APLICAÇÃO RDC | R$ 40.000,00 | Despesa | Operação (aplicação) |
| 15/10 | APLICAÇÃO RDC | R$ 23.000,00 | Despesa | Operação (aplicação) |
| 13/10 | Vanessa Rodrigues (Nelmerson) | R$ 20.000,00 | Receita | Operação (aporte) |
| 13/10 | Vanessa Rodrigues (Nelmerson) | R$ 20.000,00 | Receita | Operação (aporte) |

Os dois PIX de R$ 20.000 são reais, não duplicados: o próprio extrato do Sicoob mostra o saldo subindo R$ 23.174 entre a primeira e a segunda versão do dia 13. Em setembro, o PIX enviado para a Vanessa já estava como Operação.

Efeito em outubro:
- Receitas: R$ 105.366 → **R$ 65.367**
- Despesas: R$ 121.948 → **R$ 58.948**
- O Caixa não muda.

Com isso, outubro fica parecido com setembro (R$ 61 mil / R$ 44 mil) e com o previsto para novembro (R$ 64 mil / R$ 91 mil).

As projeções de novembro não têm duplicidade de envio. Encontrei só linhas iguais de cartão e de contas a pagar na mesma planilha, e elas parecem ser parcelas diferentes.

## O que vou fazer
1. Mudar os 4 lançamentos para **Operação** no Fluxo Bancário, com registro na auditoria.
2. Fazer "APLICAÇÃO RDC" do Sicoob de Piraquara entrar sempre como Operação daqui em diante, para não voltar a cair como despesa.
3. Conferir as telas de outubro (Dashboard e Relatório) e recalcular a lucratividade de outubro, se ela já tiver sido gravada.

Se os R$ 40 mil da Vanessa forem receita de verdade (por exemplo, um pagamento de aluno) e não aporte, me avise que deixo os dois PIX como estão.

## Detalhes técnicos
- `bank_transactions` ids 5f0e5a37…, 1600cf65… (RDC) e ab5006c3…, f20b5ae6… (PIX) → `movement_kind='operacao'`; os gatilhos de sincronização atualizam `bank_cashflow_entries` (`tipo_nome='Operação'`).
- Padrão "APLICAÇÃO RDC" em `bank_auto_invest_patterns` da escola.
- Recalcular `kpi_values` de out/2026 para lucro_* (não sobrescreve se o mês estiver fechado).

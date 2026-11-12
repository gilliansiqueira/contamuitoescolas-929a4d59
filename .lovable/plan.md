# Joinville Centro – outubro (Santander) fora do extrato

## O que encontrei (só leitura)
Comparei o PDF de outubro (469 linhas) com o que está gravado na conta Santander 4390 / 130002352:

| | Extrato PDF | Plataforma |
|---|---|---|
| Linhas de outubro | 469 | 794 |
| Entradas | R$ 399.892,63 | R$ 630.020,59 |
| Saídas | R$ 382.310,85 | R$ 620.501,37 |

- **352 linhas a mais** (≈ R$ 295 mil de entradas e R$ 312 mil de saídas). É por isso que receitas e despesas parecem bem maiores que setembro.
- Causa principal: em 04/11 subiram um OFX de **01/10 a 04/11** (289 linhas novas) por cima dos OFX diários que já cobriam outubro. Como o texto das linhas veio diferente, o sistema não reconheceu como repetidas.
- **Aplicações/resgates ContaMax**: em setembro estavam marcados como aplicação automática (só caixa). Em outubro, 39 deles ficaram como lançamento comum (R$ 191 mil entrada / R$ 272 mil saída), inflando receita e despesa.
- **27 linhas do dia 30/10 faltam** na plataforma, incluindo o Resgate ContaMax de R$ 62.217,61 — isso explica o saldo não fechar em R$ 0,00.

## O que vou fazer
1. Listar, linha a linha, cada lançamento a mais (com arquivo de origem) e cada um que falta, e te mandar a planilha antes de apagar qualquer coisa.
2. Com seu ok, remover só as duplicadas (preferindo manter a linha já conciliada).
3. Incluir as 27 linhas de 30/10 que faltam a partir do PDF, registradas como vindas deste arquivo.
4. Marcar todas as aplicações/resgates ContaMax de outubro como aplicação automática (só caixa, fora de receita e despesa).
5. Conferir: total de entradas, saídas e saldo de 31/10 iguais ao extrato (R$ 0,00 em conta corrente) e o Dashboard sem os R$ -15.727,10.
6. Ver se novembro tem o mesmo problema (o arquivo de 04/11 também gravou dias de novembro).

## Detalhes técnicos
- Conta `37ecf0a0-c576-4650-b411-ff45f626376e`; import suspeito `4cf61fec-fa18-4b7d-bf95-2a0924b4c5e5`.
- Pareamento por dia + sentido + valor; exclusões e o `movement_kind='auto_aplicacao'/'auto_resgate'` via alteração de dados, sem mudar código.
- Prevenção (opcional, depois): reforçar a detecção de repetidas para OFX Santander com textos diferentes.

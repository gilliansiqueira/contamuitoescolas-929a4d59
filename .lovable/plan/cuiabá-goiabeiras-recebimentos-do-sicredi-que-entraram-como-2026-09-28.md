# Cuiabá Goiabeiras: recebimentos do Sicredi que entraram como saída

## O que foi encontrado
Três recebimentos PIX da INFLUX ENGLISH, na conta Sicredi da Cuiabá Goiabeiras, foram gravados como **saída**:

| Data | Valor | Situação hoje |
|---|---|---|
| 14/09/2026 | R$ 1.451,52 | pendente |
| 17/09/2026 | R$ 677,60 | pendente |
| 21/09/2026 | R$ 6.291,05 | conciliado |

Juntos somam R$ 8.420,17. Hoje o saldo calculado fica **R$ 16.840,34 abaixo** do real, porque cada um desses valores deixou de entrar como receita e ainda foi descontado como saída.

**Causa:** os três aconteceram num momento em que o saldo da conta estava negativo, por exemplo "1.451,52   -22.004,53". O leitor de PDF juntou o sinal de menos do saldo ao valor do lançamento e leu "1.451,52 -" como saída. Nas 1.810 linhas de Sicredi de todas as empresas, só essas três foram afetadas.

## O que vou fazer
1. **Corrigir a leitura:** um sinal de menos seguido de outro número passa a pertencer ao saldo, não ao valor. Vou criar um teste com a linha exata do seu extrato. Os extratos dos outros bancos continuam sendo lidos como hoje.
2. **Corrigir os três lançamentos:** mudar só o sentido (saída para entrada). Valor, data, descrição, conciliação e origem do upload ficam iguais. A correção vai para o Histórico de Alterações, com o motivo.
3. **Conferir depois:** o saldo calculado do Sicredi em 28/09 tem que bater com o saldo impresso no extrato, e o Dashboard e o Fluxo Diário da empresa têm que refletir a receita.

## Regras preservadas
- Nada é apagado nem reimportado, então não cria duplicidade.
- Nenhuma outra empresa ou conta é alterada.

## Detalhes técnicos
- `parsers.ts`: no regex `VAL`, o marcador final `[-DC*]` só vale se não vier seguido de dígito: `[-DC*]?(?!\s?\d)`.
- Novo teste em `bankSicrediPdf.test.ts` com a linha "RECEBIMENTO PIX ... PIX_CRED 1.451,52 -22.004,53", que deve virar entrada.
- Correção dos dados pela ferramenta de alteração de dados, apenas para os ids `f5dcabca…`, `785eba6a…` e `31b9e2a4…`. Se o bloqueio que protege os lançamentos do banco impedir a mudança de `tipo`, antes de mexer eu explico o impacto e proponho uma liberação pontual, apenas para esses três ids.
- Em seguida, rodar `sync_bank_cashflow_school` para atualizar o Fluxo de Caixa e o `audit_log`.

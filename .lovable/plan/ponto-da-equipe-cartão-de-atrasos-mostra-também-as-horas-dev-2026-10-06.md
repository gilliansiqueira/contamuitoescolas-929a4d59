# Ponto da Equipe: cartão de atrasos mostra também as horas devidas

## O que muda
Hoje o cartão "Atrasos" na aba Dia só conta quem ficou com a situação exata "Atraso". Quem saiu antes ou tem minutos faltando (como Geise, Bruno e Rubia) não aparece ali.

- O cartão passa a se chamar **"Atrasos / horas devidas"** e conta **todas as pessoas com tempo faltando no dia** (atraso na entrada, saída antes do previsto), não só a situação "Atraso".
- Embaixo do número, o cartão mostra o **total de tempo devido no dia** (ex.: "2:15 devidas"), somando os minutos que faltaram de cada pessoa.
- Clicar no cartão filtra a tabela para mostrar só quem está devendo, como já acontece com os outros cartões.
- Na linha de cada pessoa, a coluna Situação já mostra "Faltou 0:38" — isso continua, agora alcançado pelo filtro do cartão.
- Dia "Em andamento" continua fora da conta (ninguém é marcado como devendo enquanto o expediente não fechou).

Nada muda no cálculo das horas: usa a mesma regra de hoje (`classifyDay`), já compartilhada entre as abas Dia, Resumo do mês e Extras e faltas.

## Detalhes técnicos
- `src/components/team/TeamTimePanel.tsx`:
  - No card `atraso` (linha ~178): filtro passa de `r.situacao === 'atraso'` para `r.situacao === 'atraso' || classifyDay(r.d, ...).faltaMin > 0`, respeitando `emAndamento`.
  - Subtítulo do cartão com `minToHhmm` da soma de `faltaMin` das pessoas filtradas.
  - `CardKey 'atraso'` e o filtro da tabela acompanham a mesma regra.
- Sem migração, sem mudança de permissões.

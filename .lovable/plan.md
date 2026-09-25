# Corrigir leitura do PDF do Sicoob (Piraquara)

## O que aconteceu
O PDF do Sicoob foi importado e o saldo informado está certo (R$ 20.375,72). O problema é que o sistema leu errado as linhas do extrato. Motivo: quando o valor não cabe na linha, o PDF quebra a linha do lançamento em pedaços.
- **Saídas virando entradas:** em lançamentos como "PIX EMIT.OUTRA IF 2.065,49", o "D" de débito vai para a linha de baixo. Sem ver o "D", o sistema tratava como entrada. É o caso dos R$ 2.065,49 e R$ 1.898,84, e de outros.
- **Despesas faltando:** em outros casos o valor fica na linha de cima, antes da data (por exemplo, R$ 1.297,60 e R$ 1.061,80 em 04/09). O sistema não achava valor nessa linha e pulava o lançamento.

Por isso o saldo calculado chega a R$ 80.036,98, e não aos R$ 20.375,72 do banco.

## Correção
1. Ajustar a leitura do PDF do Sicoob para juntar os pedaços de cada lançamento:
   - o valor pode vir na linha de cima ou na mesma linha;
   - o "D" ou "C" pode vir na linha seguinte.
   Uma linha de "PIX EMIT." sem marcador também passa a ser saída.
2. Criar um teste automático com este PDF de Piraquara. Ele exige que o saldo de cada dia e o saldo final (R$ 20.375,72) fechem com o extrato.
3. Refazer a importação do Sicoob de Piraquara:
   - remover a importação errada (os 55 lançamentos lidos dela saem juntos, sem deixar sobras);
   - importar de novo o mesmo PDF, já com a leitura corrigida.
   Registro tudo no histórico da empresa. Nenhum lançamento de outra conta ou de antes de setembro é tocado.
4. Abrir a tela de Piraquara e conferir que o Sicoob fecha em R$ 20.375,72.

Atenção: conciliações e classificações feitas à mão nesses 55 lançamentos do Sicoob se perdem na reimportação. Pela tela, estão todos Pendentes.

## Detalhes técnicos
- `parsePdfLines` (parsers.ts): no caminho que não é BB, agrupar as linhas por lançamento. Guardar como "pendente" um valor numérico solto numa linha antes da data e o marcador `D`/`C` solto numa linha depois. Aplicar o marcador ao lançamento anterior. Incluir `pix emit` / `deb` em `debDesc`.
- Validação interna: reconstruir o saldo do dia a partir dos "SALDO DO DIA" do PDF e avisar na importação se não fechar.
- Novo teste em `src/test/bankSicoobPdf.test.ts`, com as linhas extraídas do PDF.
- Remover a importação 33ddc59e… e reimportar pelo mesmo fluxo da tela (hash e rastreabilidade preservados).

# Rondonópolis (telefone) e Brasília Sudoeste (extrato BB)

## 1. Brasília Sudoeste — saídas do BB entrando como receita
O PDF do BB marca o sentido com "(+)" ou "(-)" depois do valor, e o leitor atual ignora essa marca. Por isso todas as linhas entram como Entrada (na tela, 8 linhas pendentes de outubro, todas como Entrada/Receita).

- Ensinar o leitor do PDF do BB a usar "(+)" = entrada e "(-)" = saída.
- Usar a linha "Saldo do dia" como conferência: se os lançamentos do dia não fecharem com o saldo, a importação é bloqueada (mesma regra já usada nos outros PDFs).
- Juntar o histórico em duas linhas (ex.: "Pix - Enviado" + "06/10 09:05 Telma…") numa descrição só.
- Criar um teste automático com este extrato (01 a 27/10).
- Corrigir o que já foi gravado em outubro na conta BB de Brasília Sudoeste: trocar o sentido das saídas que entraram como entrada, sem apagar a conciliação nem o histórico. Antes, mostrar a lista de linhas afetadas e conferir o saldo final com o PDF.

## 2. Rondonópolis — telefone na planilha de renovação
- Conferir o que foi gravado na planilha de ontem (761 linhas): se os telefones vieram do relatório e se as colunas de telefone estão marcadas como "Usar" no Modelo.
- Se faltarem nos dados, refazer a leitura com o relatório já salvo e recalcular a planilha (preservando as edições da equipe).
- Gerar o Excel de Rondonópolis aqui, abrir e conferir se o telefone aparece; enviar o arquivo para vocês.

## Detalhes técnicos
- `src/lib/bankStatements/parsers.ts`: parser BB com regex de valor `([\d.]+,\d{2}) \((\+|-)\)`, linhas "Saldo do dia"/"Saldo Anterior" como âncoras; teste em `src/test/` com fixture do PDF.
- Correção de dados via migração pontual nas `bank_transactions` da conta BB da escola (filtro por import do PDF), registrando no `audit_log`.
- Renovação: consultar `renewal_rows`/`renewal_templates` de Rondonópolis; exportar via `exportXlsx.ts` num script e inspecionar com openpyxl.

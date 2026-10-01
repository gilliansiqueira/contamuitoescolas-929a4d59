# Ponto da Equipe: importar o Relatório de Cartão Ponto (PDF)

## O que o arquivo traz (conferido)
O PDF é o relatório individual do PontoFopag de 01/09 a 01/10/2026, com **20 funcionários**. Para cada um, traz:
- nome, matrícula, departamento e função;
- jornada prevista e as marcações de cada dia (entrada e saída);
- horas trabalhadas, extras e faltas;
- observações como Férias, Feriado e "Marcações Incorretas";
- totais do mês.

Isso cobre tudo o que a aba Ponto da Equipe já mostra. Dá para alimentar a aba com ele, sem precisar da integração automática.

## Como vai funcionar
1. Na aba **Ponto da Equipe**, aparece o botão **"Importar relatório de ponto (PDF)"**. Ele fica disponível só para super admin.
2. O sistema lê o PDF e mostra uma **conferência** antes de gravar:
   - quantidade de funcionários;
   - período;
   - dias lidos por pessoa;
   - total de horas trabalhadas, extras e faltas de cada um, comparado com os totais impressos no fim de cada página.
   - Se algum total não bater, a importação é bloqueada e o sistema mostra qual funcionário e qual dia causaram a diferença.
3. Ao confirmar, os dados são gravados:
   - os funcionários;
   - os dias com marcações;
   - as ocorrências (Férias, Feriado, Marcações Incorretas, Afastamento), copiadas do relatório, sem o sistema classificar falta ou atraso por conta própria.
4. Reimportar o mesmo período substitui os dias daquele período, sem duplicar nada.
5. Cada importação fica registrada no histórico de sincronizações, com o nome do arquivo e a data.

## Privacidade
- CPF e PIS **não** são gravados nem aparecem na tela. São descartados durante a leitura do arquivo.
- Os dados continuam visíveis só para super admin e separados dos dados financeiros.
- O PDF em si não é guardado.

## Detalhes técnicos
- Leitura no frontend com o pdfjs já usado nos extratos: novo `src/lib/teamTime/cartaoPontoParser.ts`, que agrupa por "Funcionário:" e lê as linhas `dd/mm/aa Dia`. Os totais vêm do bloco "Totais". Teste com o texto deste PDF.
- Gravação pela Edge Function `pontofopag-sync` com a nova ação `import_report`. A função valida o JWT, exige `is_super_admin()` e grava com service_role:
  - `team_time_employees` (external_id = código do funcionário);
  - `team_time_daily` (delete + insert no intervalo);
  - `team_time_occurrences` (origem='relatorio_pdf');
  - `team_time_sync_runs`.
- Nenhuma mudança de estrutura no banco. As RLS atuais continuam valendo.
- `TeamTimePanel`: botão, diálogo de conferência e atualização da lista depois de gravar.

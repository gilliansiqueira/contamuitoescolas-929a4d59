# Ler o "A receber e recebidas" do Omni (Linhares) na Renovação

## Por que não leu
O arquivo tem 5 abas: Resumo, Detalhamento, Emissão de notas, Ticket mensal e Ticket semestral. A aba **"Emissão de notas"** já traz o que a Renovação precisa: aluno (Sacado), vencimento, valor pago, data de pagamento, forma de cobrança, categoria ("Parcelas de módulo") e matrícula.

Ela não foi reconhecida porque os nomes das colunas vêm com espaço ("Data Vencimento", "Nº Matrícula"). O sistema só aceitava esses nomes escritos juntos, como no Sponte ("DataVencimento"). Simulei a leitura do seu arquivo e as 5 abas foram recusadas.

## O que muda
- A aba "Emissão de notas" passa a ser lida como "Contas a Receber", mesmo com espaço ou acento nos nomes das colunas e em qualquer posição entre as abas.
- **Matrícula no formato "8028/4":** vira matrícula 8028, contrato 4, igual já fazemos com as turmas do Omni. O vínculo com o aluno é pela matrícula; só quando ela falta, o vínculo é pelo nome idêntico.
- **Situação de cada parcela:**
  - "Pago" quando tem data de pagamento;
  - "Vencido" quando o vencimento já passou sem pagamento;
  - "A vencer" nos outros casos.
- O restante segue igual: só entram as parcelas de curso/módulo, e nada do que a equipe já preencheu é sobrescrito.
- As outras abas (Resumo, Detalhamento e as de Ticket) são ignoradas nessa leitura.

## Depois de publicar
Enviar o mesmo arquivo de novo na Renovação da Linhares, no botão de Contas a Receber.

## Detalhes técnicos
- `src/lib/renewal/sponteParser.ts`: em `detectSource` e na montagem das linhas de `parseSponteMatrix`, comparar os cabeçalhos com `norm(h).replace(/ /g,'')`. Mapear para as chaves canônicas do Sponte (`Sacado`, `DataVencimento`, `DataPagamento`, `ValorPago`, `Valor`, `FormaCobranca`, `Categoria`, `NumeroMatricula`, `NumeroParcela`).
- Separar "matrícula/contrato" quando vier com "/". Criar `Situacao` quando a coluna não existir, usando `Data Pgto` e o vencimento.
- Teste em `src/test/` com linhas reais da Linhares: a aba é reconhecida, "8028/4" vira 8028/4, e a situação sai certa nos 3 casos.
- Simular de novo com o arquivo enviado e informar quantos alunos foram vinculados.

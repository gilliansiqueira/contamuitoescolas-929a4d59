# Modelos pesados de Renovação sem depender da memória do notebook

## O problema
Alguns modelos (Dourados, Manaus) estão formatados até a última linha do Excel. Por dentro ficam com 100 a 500 MB, e o navegador de um notebook com pouca memória trava antes de terminar a leitura.

## Solução
1. **Leitura no servidor quando o arquivo for grande**
   - O arquivo vai direto para o armazenamento privado da Renovação, sem ser aberto no navegador.
   - Uma função no servidor lê o arquivo aos poucos, guarda só as linhas com conteúdo (até 1.500) e devolve uma versão "enxuta", com poucos KB.
   - O navegador recebe essa versão pequena e segue o fluxo normal: mostra colunas, cores e opções de status para aprovar.
   - Arquivos pequenos continuam sendo lidos no próprio navegador, como hoje.
2. **Aviso claro quando algo falhar**
   - Barra "Enviando…" e depois "Lendo modelo no servidor…".
   - Se mesmo assim falhar, aparece uma mensagem simples explicando como limpar o arquivo: selecionar as linhas vazias abaixo dos alunos, excluir, salvar e enviar de novo.
3. **Arquivo original guardado**
   - O arquivo enviado fica salvo junto do modelo, para a equipe conferir depois se precisar.

Assim, qualquer pessoa da equipe consegue enviar o modelo, sem precisar mandar o arquivo para cá.

## Detalhes técnicos
- Limite para usar o servidor: arquivo compactado acima de ~5 MB ou leitura local que passe de 20 s.
- Nova Edge Function `renewal-slim-template`: baixa de `renewal-files` em fluxo, usa a mesma lógica do `slimXlsx.ts` (fflate streaming, corta `sheetData` em 1.500 linhas e limita as faixas de validação), envia o xlsx enxuto para `renewal-files/<school>/templates/slim-*.xlsx` e devolve o caminho.
- Verificação: `is_admin()` + `can_see_school(school_id)` pelo token do usuário.
- Frontend: `templateParser` passa a aceitar o arquivo enxuto vindo do armazenamento; o fluxo de aprovar e aplicar o modelo não muda.
- Teste: rodar a função com os arquivos de Dourados e Manaus e confirmar colunas e opções de status iguais às da leitura local.
- Sem impacto nos cálculos financeiros nem nas planilhas já criadas.

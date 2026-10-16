# Renovação: modelos de Dourados e Manaus

## O que foi encontrado
- Em **Dourados** e **Manaus Laranjeiras** nenhum modelo foi gravado: o arquivo nem chegou a ser salvo. As planilhas 2027/1 seguem com as 20 colunas padrão.
- Os dois modelos têm formatação até a última linha do Excel. Por dentro: Manaus pesa ~100 MB e Dourados ~525 MB (duas abas enormes).
- Testei aqui a leitura com os arquivos enviados: **funciona** (Manaus em 2 s, Dourados em 10 s), com colunas e listas certas. Mas consumiu até **900 MB de memória**. No navegador isso faz a aba travar ou fechar sem aviso — por isso nada é gravado e não aparece erro.
- Também falta aviso quando o envio do arquivo falha.

## O que vou fazer
1. **Leitura leve:** ler só a aba com a linha de títulos (com "Aluno") e parar nas primeiras linhas, descartando o resto enquanto descompacta. As outras abas pesadas são ignoradas. Meta: abaixo de 100 MB de memória.
2. **Leitura em segundo plano**, com "Lendo modelo…" na tela e mensagem clara se falhar.
3. **Guardar só um arquivo leve** (versão enxuta) no sistema, em vez do original de 62 MB.
4. **Avisos de erro** no envio e na gravação.
5. **Ao aprovar o modelo**, aplicar na planilha já existente da escola (sem perder correções da equipe).
6. **Dourados e Manaus:** gravo os modelos enviados e aplico nas planilhas 2027/1. Confiro ordem, cores e listas:
   - Dourados: Status Renovação = Autorizado, Contrato Pronto, Não Rematriculará, Pedagógico, Renovado.
   - Manaus: Status Renovação = Renovado, Pendente, Aguardando Retorno, Não Rematriculará; Situação do Contrato = Follow Lançado, Planejamento Enviado, Lançamento Autorizado, Cont. Ass. c/ Pendência Finan., Contrato Lançado no Sistema.
7. Publicar e pedir Ctrl + Shift + R.

## Ponto de atenção
- Manaus tem **duas colunas "Professor"** (a atual e outra mais à direita). Vou tratar a segunda como professor da próxima turma, junto com "Teacher", a menos que você diga outra coisa.

## Validação
- Teste automático com modelo de milhares de linhas vazias formatadas, medindo memória.
- Baixar o Excel de Dourados e Manaus e comparar com os modelos.

## Detalhes técnicos
- `slimXlsx`: inflar só `workbook.xml`, `sharedStrings`, `styles` e a aba alvo; cortar o stream ao passar de `SLIM_MAX_ROW`, ignorar o resto e montar zip pequeno; rodar num Web Worker.
- `useAsTemplate`: subir o zip enxuto, checar `error` do upload, depois `applyTemplateToSheet` nas sheets da escola.
- Nada muda nos cálculos financeiros.

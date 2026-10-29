# Renovação: aceitar o "Parcelas por aluno" do Omni como Contas a Receber

## O que muda para a equipe
No envio de "Contas a Receber" da Renovação, o sistema passa a aceitar também o relatório **Parcelas por aluno** do Omni (com abas "Resumo" e "Parcelas"), além do Contas a Receber do Sponte. Depois de enviar e clicar em "Recalcular planilha", as colunas Forma de pgto atual, Venc. última parcela e Término do pagamento são preenchidas sozinhas, como já acontece com o Sponte.

## Regras de leitura
- Usa a aba "Parcelas"; ignora o "Resumo" e a ordem das abas.
- O vínculo com o aluno é feito só pelo nome idêntico (ignorando acentos e maiúsculas), porque o Omni não traz matrícula. Nome repetido em dois alunos vira aviso, nunca vínculo automático.
- Contam como parcela do curso: "Parcela do Curso…", "Parcelamento (…)" e "Mensalidade Módulo". Ficam fora: Taxa de Matrícula, Reposição, Conversation Day e outras cobranças avulsas.
- Situação: "Pago" conta como quitada; "Vencido" e "A vencer" como em aberto.
- Forma de pagamento (o Omni não informa o meio):
  - todas as parcelas pagas na mesma data → "À vista";
  - senão → "Parcelado".
- Venc. última parcela = maior vencimento das parcelas do curso. Término do pagamento segue a regra atual.
- Mantém a data de corte de vencimento já configurada, como no Sponte.
- Mensagem de erro passa a citar o novo relatório quando o arquivo não for reconhecido.

## Detalhes técnicos
- `src/lib/renewal/sponteParser.ts`: nova `detectOmniParcelas` (cabeçalho com aluno, vencimento, situação, descrição, valor e sem matrícula) e `fromOmniParcelas`, que converte para as chaves do Sponte (`Sacado`, `DataVencimento`, `Situacao`, `Categoria`, `FormaCobranca`, `NumeroMatricula=null`). A categoria vem da Descrição sem o número da parcela; linhas que não são do curso recebem categoria de cobrança avulsa e caem fora pelo filtro atual. `parseSponteWorkbook` passa a procurar essa aba em qualquer posição.
- `mergeEngine.ts` continua igual: o vínculo por nome idêntico já existe quando a matrícula está vazia.
- Testes em `src/lib/renewal` com o arquivo do Cristo Rei como modelo: detecção da aba, à vista × parcelado, exclusão de taxa/reposição/Conversation Day e último vencimento.

# Uberlândia Centro — resolver Conferência com o relatório Sponte (Contas a Receber)

A planilha enviada é o "Contas a Receber" do Sponte da Uberlândia Centro (vencimentos 01/06 a 30/09/2026, 1.636 linhas). Na Conferência da Centro há 36 pendências abertas (35 "sem financeiro" + 1 "sem correspondência").

## O que será feito
1. Ler a planilha e separar só as parcelas de curso/módulo (ignorar Reposição de Aulas, taxas avulsas etc.).
2. Cruzar cada um dos 36 alunos pendentes pela matrícula (e, se faltar, pelo nome idêntico ignorando acentos/maiúsculas — nomes parecidos nunca são ligados sozinhos).
3. Classificar com a mesma regra já usada:
   - todas as parcelas do curso pagas na mesma data, ou quitadas sem atraso → "À vista";
   - demais → "Parcelado" (com vencimento da última parcela e término do pagamento).
   - Forma de pagamento real (Cartão, PIX, Boleto) vem da coluna FormaCobranca.
4. Preencher os campos na planilha da Centro só onde estiverem vazios (nunca sobrescrever o que a equipe já preencheu) e marcar como resolvidas as pendências desses alunos.
5. Deixar na Conferência quem não aparece no relatório ou tem parcela vencida, e listar os nomes na resposta.

## Detalhes técnicos
- Fonte: `renewal_issues` (school Uberlândia Centro, `resolved=false`) e `renewal_rows`.
- Atualização via escrita de dados (sem mudança de estrutura); resolve só issues dos alunos encontrados.
- O formato já é aceito pelo botão de envio (parser Sponte), então próximos envios funcionam pela tela.

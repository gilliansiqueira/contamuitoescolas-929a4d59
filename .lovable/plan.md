# Renovação Linhares — cruzar as 4 planilhas

## O que encontrei
- **Turmas Sponte** (281 alunos) e **Alunos por turma Omni** (280 alunos) trazem praticamente os mesmos alunos: 280 batem pelo nome, e a matrícula do Omni ("6909/7") é o mesmo número do contrato do Sponte.
- A planilha de Renovação da Linhares já existe com 282 alunos, montada com a planilha de turmas do Sponte enviada hoje.
- **A receber Sponte**: parcelas de out/2026 a 2027, com matrícula. **A receber Omni**: 751 parcelas (aba "Emissão de notas"), a maioria com matrícula.
- O sistema hoje aceita só uma planilha de turmas e uma de Contas a Receber por vez, e não reconhece o "Alunos por turma" do Omni. Por isso o envio não fecha.

## O que vou fazer
1. **Gerar a planilha agora**, cruzando as 4 planilhas na Renovação da Linhares:
   - Base de alunos e turmas: Sponte (já carregada). Do Omni, completar só o que estiver vazio: professor (Instrutor), livro/estágio, telefone e e-mail. Alunos que só aparecem no Omni entram como novos.
   - Financeiro: juntar as parcelas do Sponte e do Omni, ligando por matrícula e, sem matrícula, só por nome idêntico. Se a mesma parcela aparecer nos dois (mesmo aluno, vencimento e valor), conta uma vez só.
   - Preencher forma de pagamento, vencimento da última parcela e término do pagamento seguindo a regra que já usamos (à vista / parcelado), sem sobrescrever o que a equipe preencheu.
   - Quem tiver parcela vencida ou não aparecer em nenhum financeiro fica na Conferência; quem tem financeiro sem turma vai para a aba "Financeiro sem turma".
2. **Para as próximas vezes**, fazer o sistema aceitar:
   - o "Alunos por turma" do Omni como planilha de turmas;
   - mais de um arquivo de Contas a Receber juntos (Sponte + Omni), somando sem duplicar.
3. Entregar o Excel da Linhares baixado e um resumo: quantos alunos preenchidos, quantos ficaram na Conferência e por quê.

## Detalhes técnicos
- Novo detector `detectOmniAlunosPorTurma` em `sponteParser.ts`, convertendo para as chaves do Sponte (Nome=Turma, Estagio=Livro, Professor=Instrutor, NumeroMatricula=parte antes da "/").
- Envio de Contas a Receber passa a aceitar vários arquivos; parcelas unidas com chave matrícula|vencimento|valor (fallback nome normalizado) antes do motor atual.
- Atualização dos `renewal_rows` da folha atual (preenche só campos vazios/"Sem informação"), sem apagar linhas; testes para os dois detectores e a deduplicação.

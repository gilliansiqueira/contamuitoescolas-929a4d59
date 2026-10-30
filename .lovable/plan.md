# Renovação BH Cidade Jardim — Conferência

## O que encontrei
- Hoje a Conferência tem 60 avisos: 37 alunos sem parcela de curso a partir de 01/10/2026, 21 com parcelas mas sem turma, 1 em duas turmas e 1 com dois contratos.
- A planilha do Omni enviada é **só de outubro/2026 e pela data de pagamento** (106 parcelas, R$ 123.031,33). **Nenhum dos 37 alunos aparece nela**, então ela sozinha não tira esses alunos da Conferência.
- 31 desses 37 aparecem na aba "Ticket semestral" (módulo de jul–dez/2026). Ou seja, têm curso neste semestre, mas a parcela venceu/foi paga **antes de outubro**, fora do período do arquivo.

## O que vou fazer
1. Enviar esta planilha na Renovação da BH Cidade Jardim (junta com o Contas a Receber que já está lá, sem duplicar), preenchendo forma de pagamento e datas só onde estiver "Sem informação".
2. Mudar o corte da planilha para parcelas a partir de **01/05/2026** (como em São Carlos), para considerar pagamentos anteriores quando chegarem.
3. Nos 31 alunos com módulo no "Ticket semestral", trocar o aviso para "curso deste semestre encontrado no Omni, parcela anterior a outubro — confirmar pagamento", para a equipe saber que não é aluno sem financeiro.
4. Te mostrar quantos avisos ficaram e quem são.

## Para resolver de vez
Precisa do relatório do Omni **"A receber e recebidas" de 01/05/2026 a 31/12/2026, pela data de vencimento**. Com ele eu tiro da Conferência quem pagou à vista ou está em dia, como fiz em Uberlândia e São Carlos.

## Detalhes técnicos
- Envio pela tela (fluxo `contas_receber`, `mergeContasImports`), sheet `4dc7e15c-…`.
- Ajuste da mensagem `sem_financeiro` usando a aba "Ticket semestral" só como indicação; nenhum valor financeiro é alterado.

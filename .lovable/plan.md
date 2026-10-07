# Alunos das turmas em formação não contam mais como pendência

## Por que ainda aparecem
Os 8 alunos novos já estão sendo reconhecidos (etiqueta "Aluno novo 2027/1"), mas o sistema ainda os conta como itens a conferir, junto com o aviso geral "Formação: alunos novos". Por isso a Conferência mostra 55 itens.

## O que muda
- Os avisos "Aluno novo 2027/1" e "Formação: alunos novos" passam a ser **só informativos**: já entram marcados como conferidos e não contam no "Próximo passo" nem no total.
- Eles ficam num bloco separado, "Informativo (não precisa conferir)", recolhido no fim da lista. Dá para abrir e consultar.
- Na lista principal ficam só os itens que precisam de atenção: 4 sem correspondência (matrícula antiga), 40 sem parcelas, 2 que saíram da base e 1 nome parecido.
- Nada muda na planilha, nas edições da equipe nem nos dados financeiros.

## Detalhes técnicos
- `persist.ts`: ao gravar as issues, `resolved=true` para os tipos `formacao_aluno_novo` e `formacao_aluno_novo_parcelas`.
- `RenovacaoModule.tsx`: constante `INFO_KINDS`; o contador do próximo passo, o "Todas" e a lista principal ignoram esses tipos; seção recolhível para eles.
- Ajuste único nas issues atuais de Vitória: marcar esses tipos como resolvidos.

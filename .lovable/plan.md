# Renovação: só nomes idênticos e fim da versão antiga presa no navegador

## O que está acontecendo
1. **Nomes parecidos (22):** quando uma parcela do Contas a Receber não encontra a matrícula nem o nome exato nas turmas, o sistema hoje sugere alunos de nome parecido (ex.: "Alice Martinez Amorim" × "Alice Delgado de Amorim"). Essas sugestões não servem, porque o vínculo só vale com nome idêntico.
2. **Formação: nome parecido (9):** acontece o mesmo com as turmas em formação 2027/1.
3. **Os 183 continuaram depois do recálculo das 19:05:** o recálculo ainda rodou com a regra antiga. Sair e entrar no login não carrega a versão nova, porque a página não é recarregada. Rodei aqui a regra nova com os mesmos arquivos de Rondonópolis: "Sem parcelas do módulo" cai de 43 para 16, e Márcia e Jucimare deixam de aparecer.

## O que muda
1. **Nomes só idênticos:**
   - Contas a Receber: se a parcela não bate por matrícula nem por nome idêntico, ela entra em "Sem correspondência nas turmas", sem lista de parecidos. O aviso "Nome parecido" deixa de existir.
   - Turmas em formação: quem não bate exatamente vira "aluno novo", só informativo. O aviso "Formação: nome parecido" deixa de existir.
2. **Aviso de versão nova:** quando houver versão nova publicada, o sistema confere toda vez que a aba volta a ficar ativa e também a cada 5 minutos (hoje é a cada 30). O aviso "Nova versão disponível — Atualizar" aparece logo, e o clique recarrega a página.
3. **Recálculo do lado do servidor de Rondonópolis:** depois de publicar, peça para clicar em **Ctrl + Shift + R** e depois em "Recalcular planilha". O esperado é que os grupos de nome parecido sumam e que "Sem parcelas do módulo" fique em torno de 16.

## O que não muda
- As edições da equipe, os itens já conferidos e os dados financeiros continuam iguais.
- O vínculo por matrícula continua sendo o principal.

## Detalhes técnicos
- `mergeEngine.ts`: em `buildImported`, remover o ramo `nome_semelhante` (tudo vira `sem_correspondencia`); em `applyRenewedFromNextPeriod`, remover `formacao_nome_semelhante` por semelhança (vai para `novos`). O caso de nome idêntico com várias matrículas continua como aviso de ambiguidade.
- `useAppVersionCheck.ts`: intervalo de 5 min, mantendo a checagem ao voltar à aba.
- Testes em `src/test/renewal.test.ts` para nome parecido → sem correspondência / aluno novo.
